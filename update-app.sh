#!/bin/bash

# This script will back up the original app.js and replace it with our new version
cp /Users/nvenditto/Projects/Microsoft/Agents/template-doctor/frontend/js/app.js /Users/nvenditto/Projects/Microsoft/Agents/template-doctor/frontend/js/app.js.original
cp /Users/nvenditto/Projects/Microsoft/Agents/template-doctor/frontend/js/app.js.new /Users/nvenditto/Projects/Microsoft/Agents/template-doctor/frontend/js/app.js
echo "Updated app.js successfully!"
