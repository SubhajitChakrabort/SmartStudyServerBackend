
--- 

### How to Use This README

1. **Clone and Install**  
   Follow the installation steps to clone the repository and install dependencies using `npm install`.

2. **Configure the Database and Environment**  
   Update the database configuration file and create your `.env` file with your specific settings.

3. **Run Migrations**  
   Execute the migration command to set up your database tables.

4. **Start the Server**  
   Use `npm start` (or `npm run dev` for development) to run the server.

5. **Understand Environment Variables**  
   Use the provided explanations to understand the purpose of each environment variable and adjust them according to your deployment needs.

This README should serve as a comprehensive guide for developers to quickly set up and understand the backend environment and its configuration.
### How to Use This README
# Backend Setup - Node.js + MySQL

This backend is built with **Node.js**, **Express.js**, and **MySQL**. Follow the steps below to set up and run the project locally.

## Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher)
- [MySQL](https://www.mysql.com/) installed and running
- [Postman](https://www.postman.com/) (optional, for API testing)

---

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/your-repo-name.git
   cd your-repo-name
   ```
2. **Install dependencies**
   ```bash
   npm install
   ```
   3. **Configure environment variables**
   - Create a `.env` file in the root directory.
   - Add the following variables:
   ```
   DB_HOST=localhost
   DB_USER=your_mysql_username
   DB_PASSWORD=your_mysql_password
   DB_NAME=your
   JWT_SECRET=your_jwt_secret
   JUDGE0_API_KEY=your_judge0_api_key
   MAILTRAP_HOST=smtp.mailtrap.io
   MAILTRAP_PORT=2525
   MAILTRAP_USER=your_user
   MAILTRAP_PASS=your_pass
   RAZORPAY_KEY_ID=your_key
   RAZORPAY_KEY_SECRET=your_secret_key
   OPENAI_API_KEY=your_api-key
   ```
   4. **Start the server**
   bash
   npm start
   ```
   5. **Access the API**
   - The server will be running on `http://localhost:3000`.
   - You can use tools like [Postman](https://www.postman.com/) to test the API endpoints.
   ---
  6. **Database Setup**
  - Ensure you have MySQL installed and running.
  - Create a new database and update the `DB_NAME` in your `.env` file.
  - Run the database migrations using the following command:
  ```bash
  npx sequelize-cli db
  ```
  ---
  OR
  - Import the provided SQL file into your MySQL database.
  ---
  
