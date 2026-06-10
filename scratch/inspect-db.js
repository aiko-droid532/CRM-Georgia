const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: '.env' });
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function inspect() {
  try {
    console.log('--- Inspecting Project table ---');
    const resProject = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Project'
    `);
    console.table(resProject.rows);

    console.log('--- Inspecting Block table ---');
    const resBlock = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Block'
    `);
    console.table(resBlock.rows);

    console.log('--- Inspecting Unit table ---');
    const resUnit = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Unit'
    `);
    console.table(resUnit.rows);

    console.log('--- Inspecting Lead ---');
    const resLead = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Lead'
    `);
    console.table(resLead.rows);
  } catch (err) {
    console.error('Error during inspection:', err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

inspect();
