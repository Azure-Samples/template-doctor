# Frontend - Template Doctor

This folder contains the frontend application for Template Doctor.

## Prerequisites
- Node.js and npm
- Python 3
- Azure Functions Core Tools (for running the API)

## Setup Instructions

### 1. Install Dependencies
First, install the required npm packages for both the API and the frontend:

```
cd ../api
npm install
cd ../frontend
npm install
```

### 2. Start the API (Azure Function)
The backend API is located in the `../api` folder and must be running for the frontend to function properly. Start it with:

```
cd ../api
func start
```

This will start the Azure Function locally (usually on port 7071).

### 3. Start the Frontend
The frontend is a static site that can be served locally using Python:

```
cd ../frontend
python3 -m http.server 8080
```

This will serve the frontend at [http://localhost:8080](http://localhost:8080).

## Local Testing
- Ensure both the API and the frontend are running as described above.
- Open your browser and navigate to [http://localhost:8080](http://localhost:8080) to use the app.

## Notes
- The frontend expects the API to be running at its default local address (http://localhost:7071).
- If you change the API port, update the frontend configuration accordingly.

---

For any issues, please refer to the main project README or open an issue in the repository.
