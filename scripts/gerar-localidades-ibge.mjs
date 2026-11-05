// Gera a migração com os estados e municípios do IBGE. Rodar uma vez (precisa de internet):
//   node scripts/gerar-localidades-ibge.mjs
// O servidor não precisa de internet: o `prisma migrate deploy` só aplica o SQL gerado.
import { mkdirSync, writeFileSync } from 'node:fs';

const API = 'https://servicodados.ibge.gov.br/api/v1/localidades';
const PASTA = new URL('../prisma/migrations/20261105010000_localidades_ibge/', import.meta.url);

const buscar = async (rota) => {
  const resposta = await fetch(`${API}/${rota}`);
  if (!resposta.ok) throw new Error(`IBGE respondeu ${resposta.status} em /${rota}`);
  return resposta.json();
};

const texto = (valor) => `'${valor.replaceAll("'", "''")}'`;

const [estados, municipios] = await Promise.all([buscar('estados'), buscar('municipios')]);

// A UF do município vem dos 2 primeiros dígitos do código (a microrregião pode vir nula na API).
const siglaPorCodigo = new Map(estados.map((e) => [e.id, e.sigla]));
const linhasEstados = estados
  .sort((a, b) => a.id - b.id)
  .map((e) => `(${e.id}, ${texto(e.nome)}, ${texto(e.sigla)})`);
const linhasCidades = municipios
  .sort((a, b) => a.id - b.id)
  .map((m) => {
    const uf = siglaPorCodigo.get(Math.trunc(m.id / 100000));
    if (!uf) throw new Error(`Município sem UF: ${m.id} ${m.nome}`);
    return `(${m.id}, ${texto(m.nome)}, ${texto(uf)})`;
  });

const sql = `-- Estados e municípios do IBGE (${estados.length} UFs, ${municipios.length} municípios).
-- Gerado por scripts/gerar-localidades-ibge.mjs em ${new Date().toISOString().slice(0, 10)}. Não editar à mão.

CREATE UNIQUE INDEX "estados_uf_code_key" ON "estados"("uf_code");
CREATE UNIQUE INDEX "estados_uf_key" ON "estados"("uf");

INSERT INTO "estados" ("uf_code", "estado_nome", "uf") VALUES
${linhasEstados.join(',\n')}
ON CONFLICT ("uf") DO UPDATE SET "uf_code" = EXCLUDED."uf_code", "estado_nome" = EXCLUDED."estado_nome";

CREATE TEMP TABLE "ibge_municipio" ("code", "nome", "uf") AS VALUES
${linhasCidades.join(',\n')};

-- Cidade já cadastrada com o nome escrito sem acento ou em outra caixa (ex.: "sao paulo")
-- recebe o nome, o código e o estado do IBGE e mantém o id (as fichas continuam ligadas a ela).
UPDATE "cidade" c SET "nome_cidade" = m."nome", "code" = m."code", "estado_id" = e."id"
FROM "ibge_municipio" m JOIN "estados" e ON e."uf" = m."uf"
WHERE c."uf" = m."uf"
  AND unaccent(lower(trim(c."nome_cidade"))) = unaccent(lower(m."nome"))
  AND NOT EXISTS (SELECT 1 FROM "cidade" x WHERE x."uf" = m."uf" AND x."nome_cidade" = m."nome");

INSERT INTO "cidade" ("code", "nome_cidade", "uf", "estado_id")
SELECT m."code", m."nome", m."uf", e."id"
FROM "ibge_municipio" m JOIN "estados" e ON e."uf" = m."uf"
ON CONFLICT ("nome_cidade", "uf") DO UPDATE SET "code" = EXCLUDED."code", "estado_id" = EXCLUDED."estado_id";

DROP TABLE "ibge_municipio";

CREATE UNIQUE INDEX "cidade_code_key" ON "cidade"("code");
`;

mkdirSync(PASTA, { recursive: true });
writeFileSync(new URL('migration.sql', PASTA), sql);
console.log(`Migração gerada: ${estados.length} estados, ${municipios.length} municípios.`);
