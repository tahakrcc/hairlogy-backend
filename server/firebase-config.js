import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
let db;

try {
  // Option 1: Use service account key file
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } 
  // Option 2: Use service account file path
  else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const serviceAccountPath = join(__dirname, process.env.FIREBASE_SERVICE_ACCOUNT_PATH.replace('./', ''));
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
  }
  // Option 3: Use environment variables
  else if (process.env.FIREBASE_PROJECT_ID) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      })
    });
  }
  // Option 4: Default credentials (for Firebase hosting/Cloud Run)
  else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
  }

  db = admin.firestore();
  const projectId = admin.app().options.projectId || 
                    (process.env.FIREBASE_SERVICE_ACCOUNT_PATH ? 
                      JSON.parse(readFileSync(join(__dirname, process.env.FIREBASE_SERVICE_ACCOUNT_PATH.replace('./', '')), 'utf8')).project_id : 
                      null) ||
                    process.env.FIREBASE_PROJECT_ID || 
                    'N/A';
  console.log('Firebase Admin initialized successfully');
  console.log('Project ID:', projectId);
} catch (error) {
  console.error('Firebase initialization error:', error);
  console.error('Error details:', {
    message: error.message,
    code: error.code,
    stack: error.stack
  });
  console.error('\nPlease check:');
  console.error('1. FIREBASE_SERVICE_ACCOUNT_PATH is set correctly in .env');
  console.error('2. serviceAccountKey.json file exists in server/ directory');
  console.error('3. Service account key is valid');
  throw error;
}

export { db, admin };

