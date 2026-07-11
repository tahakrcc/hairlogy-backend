const axios = require('axios');
axios.post('http://localhost:3001/api/admin/login', { username: 'admin', password: 'password123' })
  .then(res => {
    const token = res.data.token;
    return axios.get('http://localhost:3001/api/admin/customers', { headers: { Authorization: `Bearer ${token}` } });
  })
  .then(res => {
    console.log('Customers response type:', typeof res.data, Array.isArray(res.data));
    console.log(JSON.stringify(res.data).substring(0, 500));
  })
  .catch(err => {
    console.error('Error:', err.response ? err.response.data : err.message);
  });
