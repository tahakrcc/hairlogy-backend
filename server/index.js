import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// CORS configuration - allow production and dev frontends
app.use(cors({
  origin: [
    'https://hairologyyasinpremiumrandevu.com',
    'https://hairlogyyasinpremium.netlify.app',
    'http://localhost:3000',
    'http://localhost:5173',
    /\.netlify\.app$/
  ],
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// Database setup
const dbPath = join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase() {
  db.serialize(() => {
    // Bookings table
    db.run(`CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barber_id INTEGER NOT NULL,
      barber_name TEXT NOT NULL,
      service_name TEXT NOT NULL,
      service_price REAL NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT,
      appointment_date TEXT NOT NULL,
      appointment_time TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Barbers table
    db.run(`CREATE TABLE IF NOT EXISTS barbers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      experience TEXT,
      specialty TEXT,
      image_url TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => {
      // Insert default barbers if they don't exist
      db.get('SELECT COUNT(*) as count FROM barbers', (err, row) => {
        if (row.count === 0) {
          db.run(`INSERT INTO barbers (name, experience, specialty, image_url) VALUES 
            ('Hıdır Yasin Gökçeoğlu', '15+ Yıl Deneyim', 'Klasik & Modern Kesimler', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop'),
            ('Emir Gökçeoğlu', '10+ Yıl Deneyim', 'Fade & Sakal Tasarımı', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop')`);
        }
      });
    });

    // Services table
    db.run(`CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      duration INTEGER NOT NULL,
      price REAL NOT NULL,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => {
      // Insert default services if they don't exist
      db.get('SELECT COUNT(*) as count FROM services', (err, row) => {
        if (row.count === 0) {
          db.run(`INSERT INTO services (name, duration, price) VALUES 
            ('Saç Kesimi', 30, 150),
            ('Saç ve Sakal', 45, 200),
            ('Sakal', 20, 100),
            ('Çocuk Tıraşı', 25, 120),
            ('Bakım/Mask', 30, 180)`);
        }
      });
    });

    // Admin users table
    db.run(`CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => {
      // Create default admin if doesn't exist
      db.get('SELECT COUNT(*) as count FROM admin_users', (err, row) => {
        if (row.count === 0) {
          const hashedPassword = bcrypt.hashSync('admin123', 10);
          db.run(`INSERT INTO admin_users (username, password) VALUES ('admin', ?)`, [hashedPassword]);
          console.log('Default admin created: username=admin, password=admin123');
        }
      });
    });
  });
}

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.userId = decoded.userId;
    next();
  });
};

// ============ PUBLIC ROUTES ============

// Get all barbers
app.get('/api/barbers', (req, res) => {
  db.all('SELECT * FROM barbers WHERE active = 1', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Get all services
app.get('/api/services', (req, res) => {
  db.all('SELECT * FROM services WHERE active = 1', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Get available time slots for a date and barber
app.get('/api/available-times', (req, res) => {
  const { barberId, date } = req.query;
  
  if (!barberId || !date) {
    return res.status(400).json({ error: 'barberId and date are required' });
  }

  // Get all bookings for this barber and date
  db.all(
    'SELECT appointment_time FROM bookings WHERE barber_id = ? AND appointment_date = ? AND status != "cancelled"',
    [barberId, date],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const bookedTimes = rows.map(row => row.appointment_time);
      
      // All possible time slots
      const allTimeSlots = [
        '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
        '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
        '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30'
      ];

      const availableTimes = allTimeSlots.filter(time => !bookedTimes.includes(time));
      res.json({ availableTimes, bookedTimes });
    }
  );
});

// Create booking
app.post('/api/bookings', (req, res) => {
  const {
    barberId,
    barberName,
    serviceName,
    servicePrice,
    customerName,
    customerPhone,
    customerEmail,
    appointmentDate,
    appointmentTime
  } = req.body;

  if (!barberId || !serviceName || !customerName || !customerPhone || !appointmentDate || !appointmentTime) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Check if time slot is available
  db.get(
    'SELECT id FROM bookings WHERE barber_id = ? AND appointment_date = ? AND appointment_time = ? AND status != "cancelled"',
    [barberId, appointmentDate, appointmentTime],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (row) {
        return res.status(400).json({ error: 'This time slot is already booked' });
      }

      // Create booking
      db.run(
        `INSERT INTO bookings (barber_id, barber_name, service_name, service_price, customer_name, customer_phone, customer_email, appointment_date, appointment_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [barberId, barberName, serviceName, servicePrice, customerName, customerPhone, customerEmail || null, appointmentDate, appointmentTime],
        function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          res.status(201).json({
            id: this.lastID,
            message: 'Booking created successfully'
          });
        }
      );
    }
  );
});

// ============ ADMIN ROUTES ============

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  db.get('SELECT * FROM admin_users WHERE username = ?', [username], (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, username: user.username });
  });
});

// Get all bookings (admin only)
app.get('/api/admin/bookings', verifyToken, (req, res) => {
  const { status, barberId, date } = req.query;
  let query = 'SELECT * FROM bookings WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (barberId) {
    query += ' AND barber_id = ?';
    params.push(barberId);
  }
  if (date) {
    query += ' AND appointment_date = ?';
    params.push(date);
  }

  query += ' ORDER BY appointment_date DESC, appointment_time DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Get booking by ID
app.get('/api/admin/bookings/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM bookings WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json(row);
  });
});

// Update booking status
app.patch('/api/admin/bookings/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  db.run(
    'UPDATE bookings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Booking not found' });
      }
      res.json({ message: 'Booking updated successfully' });
    }
  );
});

// Delete booking
app.delete('/api/admin/bookings/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM bookings WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json({ message: 'Booking deleted successfully' });
  });
});

// Get statistics
app.get('/api/admin/stats', verifyToken, (req, res) => {
  const stats = {};

  // Total bookings
  db.get('SELECT COUNT(*) as total FROM bookings', (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    stats.totalBookings = row.total;

    // Bookings by status
    db.all('SELECT status, COUNT(*) as count FROM bookings GROUP BY status', (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      stats.bookingsByStatus = rows;

      // Today's bookings
      db.get("SELECT COUNT(*) as count FROM bookings WHERE appointment_date = date('now')", (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        stats.todayBookings = row.count;

        // Total revenue
        db.get("SELECT SUM(service_price) as total FROM bookings WHERE status != 'cancelled'", (err, row) => {
          if (err) return res.status(500).json({ error: err.message });
          stats.totalRevenue = row.total || 0;
          res.json(stats);
        });
      });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


