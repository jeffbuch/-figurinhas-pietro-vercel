const { getRows, batchUpdateCells, normalizeCode, sendJson, sheetName } = require('./_sheets');

function columnIndexToLetter(index) {
  let letter = '';
  let n = index + 1;

  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }

  return letter;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Método não permitido' });
  }

  try {
    const body = req.body || {};
    const codigos = Array.isArray(body.codigos) ? body.codigos.map(normalizeCode) : [];
    const status = body.status || 'Tenho';

    if (!codigos.length) {
      return sendJson(res, 400, { error: 'Lista de códigos obrigatória' });
    }

    const { rows, columns } = await getRows();

    if (columns.status < 0) {
      return sendJson(res, 400, { error: 'Coluna Status não encontrada' });
    }

    const statusCol = columnIndexToLetter(columns.status);
    const updates = [];

    for (const code of codigos) {
      const row = rows.find((item) => normalizeCode(item.codigo) === code);
      if (row) {
        updates.push({
          range: `${sheetName()}!${statusCol}${row.rowNumber}`,
          values: [[status]]
        });
      }
    }

    await batchUpdateCells(updates);

    return sendJson(res, 200, {
      ok: true,
      updated: updates.length
    });
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { error: err.message || 'Erro ao atualizar figurinhas' });
  }
};
