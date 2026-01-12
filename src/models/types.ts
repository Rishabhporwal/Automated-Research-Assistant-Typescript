import { z } from 'zod';
import { Annotation } from '@langchain/langgraph';

// -------------------------------
// Base Types
// -------------------------------

export interface BaseModel {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// -------------------------------
// Section Model
// -------------------------------

export interface Section extends BaseModel {
  title: string;
  content: string;
  order: number;
  reportId?: string;
}

// -------------------------------
// Analyst Models
// -------------------------------

export interface Analyst extends BaseModel {
  affiliation: string;
  name: string;
  role: string;
  description: string;
  email?: string;
  expertise?: string[];
  persona?: string;
}

export interface Perspectives {
  analysts: Analyst[];
  summary?: string;
  generatedAt?: Date;
}

// -------------------------------
// Search Query
// -------------------------------

export interface SearchQuery {
  search_query: string;
  keywords?: string[];
  filters?: Record<string, any>;
  generatedAt?: Date;
}

// -------------------------------
// Interview Types
// -------------------------------

export interface InterviewMessage {
  role: 'analyst' | 'expert' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface InterviewState {
  messages: InterviewMessage[];
  max_num_turns: number;
  context: string[];
  analyst: Analyst;
  interview: string;
  sections: string[];
  current_turn: number;
  is_complete: boolean;
}

// -------------------------------
// Report Types
// -------------------------------

export interface GenerateAnalystsState {
  topic: string;
  max_analysts: number;
  human_analyst_feedback: string;
  analysts: Analyst[];
}

export interface ResearchGraphState {
  topic: string;
  max_analysts: number;
  human_analyst_feedback: string;
  analysts: Analyst[];
  sections: Annotation<string[]>;
  introduction: string;
  content: string;
  conclusion: string;
  final_report: string;
  metadata?: Record<string, any>;
}

// -------------------------------
// User Types
// -------------------------------

export interface User extends BaseModel {
  username: string;
  email: string;
  passwordHash: string;
  role: 'user' | 'admin';
  isActive: boolean;
  lastLogin?: Date;
  preferences?: Record<string, any>;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

// -------------------------------
// Report Metadata
// -------------------------------

export interface ReportMetadata extends BaseModel {
  topic: string;
  userId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  threadId: string;
  filePaths: {
    docx?: string;
    pdf?: string;
    json?: string;
  };
  analytics?: {
    wordCount: number;
    sectionCount: number;
    processingTime: number;
    cost?: number;
  };
  error?: string;
}