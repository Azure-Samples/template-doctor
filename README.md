# Template Doctor

This is the root repository for Template Doctor, a tool for analyzing, validating, and ensuring compliance of templates with organizational standards.

> **Important Note**: The implementation in the `src/backend` folder is not to be used and is just a remnant of a previous version. Please use the Azure Functions in the `api/` folder for backend services.

## Project Structure

- `api/` - Azure Functions backend providing authentication and API services
- `frontend/` - Web-based frontend for the Template Doctor application
- `src/` - Source code and utilities for template analysis
- `docs/` - Documentation for GitHub Action and App setup
- `results/` - Storage for analysis results and reports

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
- Remember that the `src/backend` implementation should not be used - it's only kept for historical reference.

## Documentation

For detailed information on specific components:

- [GitHub Action Setup](docs/GITHUB_ACTION_SETUP.md)
- [GitHub Action](docs/GITHUB_ACTION.md)
- [GitHub App](docs/GITHUB_APP.md)
- [GitHub Pages Implementation](docs/github-pages-implementation.md)

---

For any issues, please open an issue in the repository.
