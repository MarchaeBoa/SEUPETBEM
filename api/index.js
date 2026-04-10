// Entrypoint serverless do Vercel: reaproveita o app Express definido
// em server.js. O Vercel invoca o export default como handler HTTP.
module.exports = require('../server');
