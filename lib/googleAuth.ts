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

export interface AuthUser {
  email: string;
  name: string;
  picture: string;
  domain: string;
}

const AUTH_STORAGE_KEY = 'archviz_auth';

// Get allowed domain from environment
export function getAllowedDomain(): string {
  return (import.meta as any).env?.VITE_ALLOWED_DOMAIN || '';
}

// Get Google Client ID from environment
export function getGoogleClientId(): string {
  return (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';
}

// Session storage helpers (for non-secret user profile info only)
export function saveAuthSession(user: AuthUser): void {
  try {
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  } catch (error) {
  }
}

export function loadAuthSession(): AuthUser | null {
  try {
    const stored = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
  }
  return null;
}

export function clearAuthSession(): void {
  try {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (error) {
  }
}

// Initialize Google Sign-In
// On success, exchanges the Google ID token with the gateway for a short-lived JWT
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

  // Wait for Google script to load (max 5s before showing error)
  let gsiRetries = 0;
  const GSI_MAX_RETRIES = 50; // 50 * 100ms = 5s
  const initGoogle = () => {
    if (!window.google?.accounts?.id) {
      gsiRetries++;
      if (gsiRetries >= GSI_MAX_RETRIES) {
        onError('Google Sign-In could not load. This may happen if Google services are blocked in your region. Please check your VPN/network connection and reload.');
        return;
      }
      setTimeout(initGoogle, 100);
      return;
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response: GoogleCredentialResponse) => {
        try {
          // Exchange Google ID token for gateway JWT (server-side verified)
          const { verifyAuth } = await import('../services/apiGateway');
          const authResult = await verifyAuth(response.credential);
          const user: AuthUser = authResult.user;

          saveAuthSession(user);
          onSuccess(user);
        } catch (error: any) {
          onError(error.message || 'Authentication failed. Please try again.');
        }
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

