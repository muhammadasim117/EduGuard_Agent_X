/**
 * EduGuard Agent - Centralized API Service Layer
 * Interacts with the backend, managing authentication, serialization,
 * error handling, and type safety.
 */

import {
  AuthResponse,
  AuthUser,
  FlaggedAccount,
  HealthResponse,
  Incident,
  AnalysisRecord,
  DecisionRecord,
  User,
  Permission,
  Student,
  AccessLog,
} from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function getStoredToken(): string | null {
  try {
    return localStorage.getItem('eduguard_auth_token');
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem('eduguard_auth_token', token);
    } else {
      localStorage.removeItem('eduguard_auth_token');
    }
  } catch {
    // Ignore localStorage errors
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const token = getStoredToken();

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err: any) {
    throw new ApiError(
      'Network request failed. Please check your connection to the EduGuard server.',
      0,
      err
    );
  }

  // Handle expected 404 for unanalyzed incident gracefully if caller opts in
  if (response.status === 404 && path.includes('/analysis')) {
    throw new ApiError('Not analyzed yet', 404);
  }

  let data: any = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    let message = 'An unexpected server error occurred.';
    if (typeof data === 'object' && data?.detail) {
      if (typeof data.detail === 'string') {
        message = data.detail;
      } else if (Array.isArray(data.detail)) {
        message = data.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
      }
    } else if (typeof data === 'string' && data.length > 0) {
      message = data;
    }

    if (response.status === 502) {
      message = message.includes('Evolus') || message.includes('AMD') || message.includes('not configured')
        ? message
        : 'The analysis service is temporarily unavailable. Please try again.';
    }

    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

export const api = {
  // Authentication
  async login(credentials: {email: string; password: string}): Promise<AuthResponse> {
    const res = await request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    setStoredToken(res.token);
    return res;
  },

  async signup(payload: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
  }): Promise<AuthResponse> {
    const res = await request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setStoredToken(res.token);
    return res;
  },

  async logout(): Promise<void> {
    try {
      await request('/auth/logout', {method: 'POST'});
    } catch {
      // Clean up token locally even if network fails
    } finally {
      setStoredToken(null);
    }
  },

  async getMe(): Promise<AuthUser> {
    return request<AuthUser>('/auth/me');
  },

  // Health and Status
  async getHealth(): Promise<HealthResponse> {
    return request<HealthResponse>('/health');
  },

  // Proactive Scan: Flagged Accounts
  async getScan(minSeverity: string = 'low'): Promise<FlaggedAccount[]> {
    return request<FlaggedAccount[]>(`/scan?min_severity=${encodeURIComponent(minSeverity)}`);
  },

  // Incidents
  async getIncidents(userId?: string, expectedRisk?: string): Promise<Incident[]> {
    const params = new URLSearchParams();
    if (userId) params.set('user_id', userId);
    if (expectedRisk) params.set('expected_risk', expectedRisk);
    const query = params.toString();
    return request<Incident[]>(`/incidents${query ? `?${query}` : ''}`);
  },

  async getIncident(incidentId: string): Promise<Incident> {
    return request<Incident>(`/incidents/${encodeURIComponent(incidentId)}`);
  },

  // Incident Analysis
  async getIncidentAnalysis(incidentId: string): Promise<AnalysisRecord | null> {
    try {
      const res = await request<any>(`/incidents/${encodeURIComponent(incidentId)}/analysis`);
      if (!res || res.detail === 'Not analyzed yet' || res.status === 404 || (!res.analysis && !res.risk_level && !res.incident_type)) {
        return null;
      }
      return res as AnalysisRecord;
    } catch (err: any) {
      if (
        err?.status === 404 ||
        err?.statusCode === 404 ||
        (err instanceof ApiError && err.status === 404) ||
        (typeof err?.message === 'string' && (err.message.includes('Not analyzed') || err.message.includes('not found') || err.message.includes('404')))
      ) {
        return null; // Not analyzed yet: normal expected state
      }
      throw err;
    }
  },

  async analyzeIncident(incidentId: string): Promise<AnalysisRecord> {
    return request<AnalysisRecord>(`/incidents/${encodeURIComponent(incidentId)}/analyze`, {
      method: 'POST',
    });
  },

  // Administrator Decisions
  async submitDecision(
    incidentId: string,
    body: {
      decision: 'approve' | 'reject' | 'escalate';
      decided_by: string;
      note?: string;
    }
  ): Promise<AnalysisRecord> {
    return request<AnalysisRecord>(`/incidents/${encodeURIComponent(incidentId)}/decision`, {
      method: 'POST',
      body: JSON.stringify({
        decision: body.decision,
        decided_by: body.decided_by,
        note: body.note || '',
      }),
    });
  },

  // Supporting School District Datasets
  async getUsers(role?: string): Promise<User[]> {
    const query = role ? `?role=${encodeURIComponent(role)}` : '';
    return request<User[]>(`/users${query}`);
  },

  async getPermissions(userId?: string): Promise<Permission[]> {
    const query = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
    return request<Permission[]>(`/permissions${query}`);
  },

  async getStudents(className?: string): Promise<Student[]> {
    const query = className ? `?class=${encodeURIComponent(className)}` : '';
    return request<Student[]>(`/students${query}`);
  },

  async getAccessLogs(params: {
    user_id?: string;
    student_id?: string;
    action?: string;
    result?: string;
    limit?: number;
  } = {}): Promise<AccessLog[]> {
    const q = new URLSearchParams();
    if (params.user_id) q.set('user_id', params.user_id);
    if (params.student_id) q.set('student_id', params.student_id);
    if (params.action) q.set('action', params.action);
    if (params.result) q.set('result', params.result);
    if (params.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return request<AccessLog[]>(`/access-logs${qs ? `?${qs}` : ''}`);
  },
};
