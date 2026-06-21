const { getRows, updateCell, normalizeCode, sendJson } = require('./_sheets');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Método não permitido' });
  }

  try {
    const body = req.body || {};
    const codigo = normalizeCode(body.codigo);

    if (!codigo) {
      return sendJson(res, 400, { error: 'Código obrigatório' });
    }

    const { rows, columns } = await getRows();
    const row = rows.find((item) => normalizeCode(item.codigo) === codigo);

    if (!row) {
      return sendJson(res, 404, { error: `Código ${codigo} não encontrado` });
    }

    const tasks = [];

    if (body.status !== undefined) {
      tasks.push(updateCell(row.rowNumber, columns.status, body.status));
    }

    if (body.repetidas !== undefined) {
      const value = Math.max(Number(body.repetidas) || 0, 0);
      tasks.push(updateCell(row.rowNumber, columns.repetidas, value));
    }

    if (body.observacoes !== undefined) {
      tasks.push(updateCell(row.rowNumber, columns.observacoes, body.observacoes));
    }

    await Promise.all(tasks);

    return sendJson(res, 200, { ok: true, codigo });
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { error: err.message || 'Erro ao atualizar figurinha' });
  }
};
