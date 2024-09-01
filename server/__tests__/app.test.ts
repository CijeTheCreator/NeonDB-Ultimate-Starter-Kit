import request from 'supertest';
import app from '../app';  // Adjust the path according to your project structure

describe('User API Endpoints', () => {
    it('GET /api/users should return a list of users', async () => {
        const response = await request(app).get('/api/users');
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message', 'List of users');
    });

    it('POST /api/users should add a new user', async () => {
        const response = await request(app)
            .post('/api/users')
            .send({ name: 'John Doe' });
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message', 'User added');
    });

    // Add more tests as needed
});
