// Google Identity Services types
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleIdConfig) => void;
          renderButton: (element: HTMLElement, config: GoogleButtonConfig) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface GoogleIdConfig {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
}

interface GoogleButtonConfig {
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  type?: 'standard' | 'icon';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  logo_alignment?: 'left' | 'center';
  width?: number;
}

interface GoogleCredentialResponse {
  credential: string;
  select_by: string;
}

interface GoogleJwtPayload {
  email: string;
  email_verified: boolean;
  name: string;
  picture: string;
  given_name: string;
  family_name: string;
  sub: string;
  aud: string;
  iss: string;
  exp: number;
  iat: number;
  hd?: string; // Hosted domain (Google Workspace domain)
}

export interface AuthUser {
  email: string;
  name: string;
  picture: string;
  domain: string;
}

const AUTH_STORAGE_KEY = 'archviz_auth';

// Decode JWT token (base64url)
function decodeJwt(token: string): GoogleJwtPayload {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  return JSON.parse(jsonPayload);
}

// Extract domain from email
function getDomainFromEmail(email: string): string {
  return email.split('@')[1]?.toLowerCase() || '';
}

// Verify email domain matches allowed domain
export function verifyDomain(email: string, allowedDomain: string): boolean {
  const userDomain = getDomainFromEmail(email);
  return userDomain === allowedDomain.toLowerCase();
}

// Get allowed domain from environment
export function getAllowedDomain(): string {
  return (import.meta as any).env?.VITE_ALLOWED_DOMAIN || '';
}

// Get Google Client ID from environment
export function getGoogleClientId(): string {
  return (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';
}

// Process Google credential and extract user info
export function processGoogleCredential(credential: string): AuthUser | null {
  try {
    const payload = decodeJwt(credential);

    if (!payload.email || !payload.email_verified) {
      return null;
    }

    return {
      email: payload.email,
      name: payload.name || payload.email,
      picture: payload.picture || '',
      domain: getDomainFromEmail(payload.email),
    };
  } catch (error) {
    console.error('Failed to decode Google credential:', error);
    return null;
  }
}

// Session storage helpers
export function saveAuthSession(user: AuthUser): void {
  try {
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('Failed to save auth session:', error);
  }
}

export function loadAuthSession(): AuthUser | null {
  try {
    const stored = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load auth session:', error);
  }
  return null;
}

export function clearAuthSession(): void {
  try {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear auth session:', error);
  }
}

// Initialize Google Sign-In
export function initializeGoogleSignIn(
  buttonElement: HTMLElement,
  onSuccess: (user: AuthUser) => void,
  onError: (error: string) => void
): void {
  const clientId = getGoogleClientId();
  const allowedDomain = getAllowedDomain();

  if (!clientId) {
    onError('Google Client ID not configured. Please set VITE_GOOGLE_CLIENT_ID in your .env file.');
    return;
  }

  if (!allowedDomain) {
    onError('Allowed domain not configured. Please set VITE_ALLOWED_DOMAIN in your .env file.');
    return;
  }

  // Wait for Google script to load
  const initGoogle = () => {
    if (!window.google?.accounts?.id) {
      setTimeout(initGoogle, 100);
      return;
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response: GoogleCredentialResponse) => {
        const user = processGoogleCredential(response.credential);

        if (!user) {
          onError('Failed to process Google sign-in. Please try again.');
          return;
        }

        if (!verifyDomain(user.email, allowedDomain)) {
          onError(`Access denied. Only ${allowedDomain} accounts are allowed.`);
          return;
        }

        saveAuthSession(user);
        onSuccess(user);
      },
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    window.google.accounts.id.renderButton(buttonElement, {
      theme: 'outline',
      size: 'large',
      type: 'standard',
      shape: 'rectangular',
      text: 'signin_with',
      logo_alignment: 'left',
      width: 280,
    });
  };

  initGoogle();
}

export {};
