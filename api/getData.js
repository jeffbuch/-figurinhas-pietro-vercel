const { getRows, sendJson } = require('./_sheets');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Método não permitido' });
  }

  try {
    const { rows } = await getRows();
    return sendJson(res, 200, { stickers: rows });
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { error: err.message || 'Erro ao carregar planilha' });
  }
};
