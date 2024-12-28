import express from 'express';
import { QueryController } from './controllers/QueryControllers';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());
//app.use(express.urlencoded({ extended: true }));

const queryController = new QueryController(process.env.DO_SPACES_NAME || '');
app.get('/', 
    (req, res) => {
        res.send('Hello World');
    }
)
app.post('/query', (req, res) => queryController.handleQuery(req, res));


// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

export default app;