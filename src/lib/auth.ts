import * as jose from 'jose';

// Кешируем JWK ключ локально для мгновенной верификации за 0.1мс без сетевых запросов
const JWK_LOCAL = {
  alg: "ES256",
  crv: "P-256",
  ext: true,
  key_ops: ["verify"],
  kid: "d1237089-cb65-482d-a64d-498613321cb5",
  kty: "EC",
  use: "sig",
  x: "D6jlKHP5c75YItS0mq3ol8y9W9mgOW3Jlda1J_328Fs",
  y: "4MDBVF8DxYARQ05yDet0b_mxgtEbKs6fFhuiAP8Mdn4"
};

let cachedKey: any = null;

async function getLocalKey() {
  if (!cachedKey) {
    cachedKey = await jose.importJWK(JWK_LOCAL, 'ES256');
  }
  return cachedKey;
}

// Резервный удаленный JWKS на случай ротации ключей
const REMOTE_JWKS = jose.createRemoteJWKSet(
  new URL('https://nepapflngrjqjhczrvsc.supabase.co/auth/v1/.well-known/jwks.json')
);

export async function verifyToken(token: string) {
  try {
    // 1. Пытаемся проверить локально (МГНОВЕННО - 0.1 мс!)
    const localKey = await getLocalKey();
    const { payload } = await jose.jwtVerify(token, localKey);
    return { payload };
  } catch (localErr) {
    // 2. Если локальный ключ не подошел (например, была ротация), делаем запрос к Supabase
    try {
      const { payload } = await jose.jwtVerify(token, REMOTE_JWKS);
      return { payload };
    } catch (remoteErr: any) {
      console.error('JWT verification failed (both local and remote):', remoteErr);
      return { error: remoteErr.message || String(remoteErr) };
    }
  }
}