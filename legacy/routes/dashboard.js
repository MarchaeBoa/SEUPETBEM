const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/dashboard/stats - retorna métricas gerais do negócio.
 */
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const bid = req.user.business_id;

    // Executa as queries em paralelo — todas são independentes.
    const [
      totalClientsR,
      totalPetsR,
      totalAppointmentsR,
      upcomingR,
      revenueR,
      monthRevenueR,
      nextAppointmentsR,
    ] = await Promise.all([
      db.execute({
        sql: 'SELECT COUNT(*) AS n FROM clients WHERE business_id = ?',
        args: [bid],
      }),
      db.execute({
        sql: 'SELECT COUNT(*) AS n FROM pets WHERE business_id = ?',
        args: [bid],
      }),
      db.execute({
        sql: 'SELECT COUNT(*) AS n FROM appointments WHERE business_id = ?',
        args: [bid],
      }),
      db.execute({
        sql: `SELECT COUNT(*) AS n FROM appointments
              WHERE business_id = ? AND status = 'agendado' AND scheduled_at >= datetime('now')`,
        args: [bid],
      }),
      db.execute({
        sql: `SELECT COALESCE(SUM(price), 0) AS total FROM appointments
              WHERE business_id = ? AND status = 'concluido'`,
        args: [bid],
      }),
      db.execute({
        sql: `SELECT COALESCE(SUM(price), 0) AS total FROM appointments
              WHERE business_id = ? AND status = 'concluido'
                AND scheduled_at >= datetime('now', 'start of month')`,
        args: [bid],
      }),
      db.execute({
        sql: `SELECT a.id, a.service, a.scheduled_at, a.status, a.price,
                     p.name AS pet_name, c.name AS client_name
              FROM appointments a
              JOIN pets p ON p.id = a.pet_id
              JOIN clients c ON c.id = p.client_id
              WHERE a.business_id = ? AND a.scheduled_at >= datetime('now')
              ORDER BY a.scheduled_at ASC
              LIMIT 5`,
        args: [bid],
      }),
    ]);

    res.json({
      stats: {
        total_clients: totalClientsR.rows[0].n,
        total_pets: totalPetsR.rows[0].n,
        total_appointments: totalAppointmentsR.rows[0].n,
        upcoming_appointments: upcomingR.rows[0].n,
        total_revenue: revenueR.rows[0].total,
        month_revenue: monthRevenueR.rows[0].total,
      },
      next_appointments: nextAppointmentsR.rows,
    });
  })
);

module.exports = router;
