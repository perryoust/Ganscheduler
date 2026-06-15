const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const serviceAccount = require('./google-credentials.json');

initializeApp({
  credential: cert(serviceAccount)
});

getAuth().getUserByEmail('worker@ganmanager.app')
  .then((userRecord) => {
    return getAuth().updateUser(userRecord.uid, {
      password: 'worker123'
    });
  })
  .then(() => {
    console.log('Successfully updated user');
    process.exit(0);
  })
  .catch((error) => {
    if (error.code === 'auth/user-not-found') {
      getAuth().createUser({
        email: 'worker@ganmanager.app',
        password: 'worker123',
        displayName: 'Worker'
      }).then(() => {
         console.log('Successfully created user');
         process.exit(0);
      });
    } else {
      console.log('Error updating user:', error);
      process.exit(1);
    }
  });
