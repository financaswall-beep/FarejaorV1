/**
 * Esqueleto de helpers de banco para testes.
 *
 * Nesta entrega (F1-04) não há conexão real com o banco.
 * As funções abaixo são placeholders para serem preenchidas
 * nas tasks F1-01 (dedup) e F1-02 (watermark), quando o código
 * de produção correspondente for escrito.
 */

export async function setupTestDatabase(): Promise<void> {
  // TODO(F1-01): inicializar pool de conexões de teste e rodar migrations.
}

export async function teardownTestDatabase(): Promise<void> {
  // TODO(F1-01): encerrar pool e limpar dados de teste.
}

export async function resetTestTables(): Promise<void> {
  // TODO(F1-02): truncar tabelas normalizadas entre testes.
}
