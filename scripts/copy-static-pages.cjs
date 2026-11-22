const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const siteDir = path.join(__dirname, '..', 'outreach-site');

if (!fs.existsSync(distDir)) {
  console.error('dist directory does not exist!');
  process.exit(1);
}

// Ensure folders exist
['privacy', 'terms', 'home'].forEach((dir) => {
  const target = path.join(distDir, dir);
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
});

// Copy files
// Privacy Policy
fs.copyFileSync(path.join(siteDir, 'privacy.html'), path.join(distDir, 'privacy.html'));
fs.copyFileSync(path.join(siteDir, 'privacy.html'), path.join(distDir, 'privacy', 'index.html'));

// Terms of Service
fs.copyFileSync(path.join(siteDir, 'terms.html'), path.join(distDir, 'terms.html'));
fs.copyFileSync(path.join(siteDir, 'terms.html'), path.join(distDir, 'terms', 'index.html'));

// Home / Landing
fs.copyFileSync(path.join(siteDir, 'index.html'), path.join(distDir, 'landing.html'));
fs.copyFileSync(path.join(siteDir, 'index.html'), path.join(distDir, 'home', 'index.html'));

// App routes to mirror for SPA routing without 404
const appRoutes = ['accounts', 'contacts', 'campaigns', 'follow-ups', 'replies', 'analytics', 'settings', 'templates'];
const mainAppHtml = path.join(distDir, 'index.html');

appRoutes.forEach((route) => {
  const targetDir = path.join(distDir, route);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  fs.copyFileSync(mainAppHtml, path.join(targetDir, 'index.html'));
});

console.log('Successfully copied all static legal, landing, and SPA route pages to dist/');
