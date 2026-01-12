export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ReportStatusResponse {
  status: 'in_progress' | 'completed' | 'error' | 'unknown';
  thread_id?: string;
  docx_path?: string;
  pdf_path?: string;
  final_report?: string;
  error?: string;
}

export interface StartReportResponse {
  thread_id: string;
  message: string;
}

export interface ReportRequest {
  topic: string;
  max_analysts?: number;
  feedback?: string;
}

export interface FeedbackRequest {
  thread_id: string;
  feedback: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface SignupRequest {
  username: string;
  password: string;
}
