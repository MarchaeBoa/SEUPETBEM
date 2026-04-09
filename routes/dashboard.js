const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/dashboard/stats - retorna métricas gerais do negócio.
 */
router.get('/stats', (req, res) => {
  const bid = req.user.business_id;

  const totalClients = db
    .prepare('SELECT COUNT(*) AS n FROM clients WHERE business_id = ?')
    .get(bid).n;

  const totalPets = db
    .prepare('SELECT COUNT(*) AS n FROM pets WHERE business_id = ?')
    .get(bid).n;

  const totalAppointments = db
    .prepare('SELECT COUNT(*) AS n FROM appointments WHERE business_id = ?')
    .get(bid).n;

  const upcoming = db
    .prepare(
      `SELECT COUNT(*) AS n FROM appointments
       WHERE business_id = ? AND status = 'agendado' AND scheduled_at >= datetime('now')`
    )
    .get(bid).n;

  const revenueRow = db
    .prepare(
      `SELECT COALESCE(SUM(price), 0) AS total FROM appointments
       WHERE business_id = ? AND status = 'concluido'`
    )
    .get(bid);

  const monthRevenueRow = db
    .prepare(
      `SELECT COALESCE(SUM(price), 0) AS total FROM appointments
       WHERE business_id = ? AND status = 'concluido'
         AND scheduled_at >= datetime('now', 'start of month')`
    )
    .get(bid);

  const nextAppointments = db
    .prepare(
      `SELECT a.id, a.service, a.scheduled_at, a.status, a.price,
              p.name AS pet_name, c.name AS client_name
       FROM appointments a
       JOIN pets p ON p.id = a.pet_id
       JOIN clients c ON c.id = p.client_id
       WHERE a.business_id = ? AND a.scheduled_at >= datetime('now')
       ORDER BY a.scheduled_at ASC
       LIMIT 5`
    )
    .all(bid);

  res.json({
    stats: {
      total_clients: totalClients,
      total_pets: totalPets,
      total_appointments: totalAppointments,
      upcoming_appointments: upcoming,
      total_revenue: revenueRow.total,
      month_revenue: monthRevenueRow.total,
    },
    next_appointments: nextAppointments,
  });
});

module.exports = router;
