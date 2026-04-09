const express = require('express');
const { query, queryOne } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/dashboard/stats - retorna métricas gerais do negócio.
 */
router.get('/stats', async (req, res, next) => {
  try {
    const bid = req.user.business_id;

    // Um único round-trip agrupando todas as contagens/somatórios.
    const totals = await queryOne(
      `SELECT
         (SELECT COUNT(*)::int FROM clients      WHERE business_id = $1) AS total_clients,
         (SELECT COUNT(*)::int FROM pets         WHERE business_id = $1) AS total_pets,
         (SELECT COUNT(*)::int FROM appointments WHERE business_id = $1) AS total_appointments,
         (SELECT COUNT(*)::int FROM appointments
           WHERE business_id = $1 AND status = 'agendado' AND scheduled_at >= NOW()
         ) AS upcoming_appointments,
         (SELECT COALESCE(SUM(price), 0)::float FROM appointments
           WHERE business_id = $1 AND status = 'concluido'
         ) AS total_revenue,
         (SELECT COALESCE(SUM(price), 0)::float FROM appointments
           WHERE business_id = $1 AND status = 'concluido'
             AND scheduled_at >= date_trunc('month', NOW())
         ) AS month_revenue`,
      [bid]
    );

    const nextAppointments = await query(
      `SELECT a.id, a.service, a.scheduled_at, a.status, a.price,
              p.name AS pet_name, c.name AS client_name
         FROM appointments a
         JOIN pets p ON p.id = a.pet_id
         JOIN clients c ON c.id = p.client_id
        WHERE a.business_id = $1 AND a.scheduled_at >= NOW()
        ORDER BY a.scheduled_at ASC
        LIMIT 5`,
      [bid]
    );

    res.json({
      stats: {
        total_clients: totals.total_clients,
        total_pets: totals.total_pets,
        total_appointments: totals.total_appointments,
        upcoming_appointments: totals.upcoming_appointments,
        total_revenue: totals.total_revenue,
        month_revenue: totals.month_revenue,
      },
      next_appointments: nextAppointments,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
