import { Capacitor } from '@capacitor/core';

const AUTH_TOKEN_KEY = 'dime_time_auth_token';

export function saveAuthToken(token: string): void {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch (e) {
    console.warn('Failed to save auth token:', e);
  }
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch (e) {
    console.warn('Failed to get auth token:', e);
    return null;
  }
}

export function clearAuthToken(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch (e) {
    console.warn('Failed to clear auth token:', e);
  }
}

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}
