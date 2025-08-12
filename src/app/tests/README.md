# Template Doctor Frontend Tests

This directory contains tests for the Template Doctor frontend, focusing on app.js functionality including repository search, template matching, and URL handling.

## Test Structure

- `app.spec.js`: Tests for basic application functionality
- `url-search.spec.js`: Tests for URL matching and search functionality
- `edge-cases.spec.js`: Tests for edge cases in the URL matching logic

## Running Tests

The tests are built with Playwright. To run them:

### From the frontend directory

```bash
# Install dependencies (first time only)
npm install

# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests in debug mode
npm run test:debug
```

## What These Tests Cover

1. **URL Matching**: Testing that repository URLs in various formats can be matched to templates
2. **Template Highlighting**: Testing that templates are correctly highlighted when found
3. **Edge Cases**: Testing handling of trailing slashes, .git extensions, and duplicate repo names

## Test Strategy

These tests mock the template data and inject it into the page to test the search functionality.
They verify that:

1. Searching with a full URL finds the correct template
2. Searching with just the repository name finds the correct template
3. Searching with special cases (trailing slashes, etc.) works correctly

The tests also check that the UI correctly indicates when a match is found.

## Adding More Tests

To add more tests, create additional spec files in this directory. Follow the pattern of mocking the necessary data and testing specific functionality.
