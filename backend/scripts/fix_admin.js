import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { createPool } from '../src/config/db.js'

async function run() {
  const pool = await createPool()
  try {
    const [admins] = await pool.query(
      'SELECT id, email, role FROM users WHERE email=? OR role=?',
      ['admin@bytestart.local', 'admin'],
    )
    console.log('Admin accounts found:', JSON.stringify(admins, null, 2))
    
    const password = 'Admin123!'
    const hash = await bcrypt.hash(password, 10)
    
    for (const admin of admins) {
      console.log(`Setting password for ${admin.email} (ID: ${admin.id}) to Admin123!...`)
      await pool.query('UPDATE users SET password_hash=? WHERE id=?', [hash, admin.id])
    }
    
    console.log('All admin passwords reset successfully! ✓')
  } catch (e) {
    console.error('Error:', e)
  } finally {
    await pool.end()
  }
}

run()
