import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export type ChatGPTUser = {
  id: string;
  email: string;
  name?: string;
};

export function chatGPTSignInPath(returnTo = '/') {
  const safeReturnTo = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';
  return `/signin-with-chatgpt?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  // 本地调试旁路：standalone 服务器没有 vinext dev 的本地 sign-in 中间件，
  // 通过 SITES_LOCAL_AUTH=1 注入一个本地演示用户，避免跳转到登录页。
  if (process.env.SITES_LOCAL_AUTH === '1') {
    return { id: 'local_seedy', email: 'seedy@sites.test', name: 'Seedy' };
  }

  const requestHeaders = await headers();
  const id = requestHeaders.get('oai-authenticated-user-id');
  const email = requestHeaders.get('oai-authenticated-user-email');

  if (!id || !email) return null;

  const encodedName = requestHeaders.get('oai-authenticated-user-full-name');
  const encoding = requestHeaders.get('oai-authenticated-user-full-name-encoding');
  let name: string | undefined;

  if (encodedName && encoding === 'percent-encoded-utf-8') {
    try {
      name = decodeURIComponent(encodedName);
    } catch {
      name = undefined;
    }
  }

  return { id, email, name };
}

export async function requireChatGPTUser(returnTo = '/') {
  const user = await getChatGPTUser();
  if (!user) redirect(chatGPTSignInPath(returnTo));
  return user;
}
