// Modo single-tenant: sem auth, workspace fixo do .env.
// Anyone with the URL gets access — risco aceito.

export function workspaceId(): string {
  const id = process.env.DEFAULT_WORKSPACE_ID;
  if (!id) throw new Error('DEFAULT_WORKSPACE_ID não configurado');
  return id;
}
