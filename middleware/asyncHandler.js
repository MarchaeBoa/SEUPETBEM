/**
 * Wrapper para route handlers assíncronos.
 *
 * O Express 4 não captura automaticamente rejeições de Promises em
 * handlers async — sem isto, um `throw` dentro de um handler async faz
 * a requisição pendurar. Este helper encaminha qualquer erro ao
 * middleware de tratamento de erros via `next(err)`.
 */
module.exports = function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
