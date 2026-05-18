type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  token?: string;
  body?: unknown;
  formBody?: string;
};

type UnauthorizedHandler = () => void | Promise<void>;

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, message: string, detail: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

const API_BASE_URL = 'https://lotus-backend-production-789d.up.railway.app';

let unauthorizedHandler: UnauthorizedHandler | null = null;
let isUnauthorizedHandling = false;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let body: string | undefined;
  if (options.formBody) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = options.formBody;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body,
    });
  } catch {
    throw new Error(
      `Ağ bağlantı hatası. Backend erişilemiyor: ${API_BASE_URL}. ` +
        'Backend servisinin çalıştığını ve internet bağlantını kontrol et.'
    );
  }

  const text = await response.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && options.token && unauthorizedHandler && !isUnauthorizedHandling) {
      isUnauthorizedHandling = true;
      Promise.resolve(unauthorizedHandler()).finally(() => {
        isUnauthorizedHandling = false;
      });
    }

    const detail = data?.detail;
    const message =
      typeof detail === 'string'
        ? detail
        : text?.trim()
          ? `${text.trim()} (${response.status})`
          : `İstek başarısız (${response.status})`;
    throw new ApiError(response.status, message, detail);
  }

  return data as T;
}

export const apiClient = { request, API_BASE_URL, setUnauthorizedHandler };
