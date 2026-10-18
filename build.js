const fs = require('fs');
const path = require('path');
const https = require('https');
const AdmZip = require('adm-zip');

function downloadBuffer(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return downloadBuffer(res.headers.location).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`Failed to download: ${res.statusCode}`));
            }
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', reject);
    });
}

function normalizeZipFolder(teamDir) {
    const files = fs.readdirSync(teamDir);
    if (!files.includes('index.html') && files.length === 1) {
        const innerPath = path.join(teamDir, files[0]);
        if (fs.statSync(innerPath).isDirectory()) {
            const innerFiles = fs.readdirSync(innerPath);
            innerFiles.forEach(file => {
                fs.renameSync(path.join(innerPath, file), path.join(teamDir, file));
            });
            fs.rmdirSync(innerPath);
        }
    }
}

function normalizeStylesheets(teamDir) {
    if (fs.existsSync(teamDir) && fs.statSync(teamDir).isDirectory()) {
        const files = fs.readdirSync(teamDir);
        files.forEach(file => {
            if (file !== 'style.css' && file.toLowerCase().endsWith('.css')) {
                fs.renameSync(path.join(teamDir, file), path.join(teamDir, 'style.css'));
            }
        });
    }
}

async function generateSite() {
    const preEventRaw = fs.readFileSync('submissions.json', 'utf8');
    const postEventRaw = fs.readFileSync('responses.json', 'utf8');

    const preEventData = JSON.parse(preEventRaw);
    const postEventData = JSON.parse(postEventRaw).responses;

    const publicDir = path.join(__dirname, 'Bash');
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
    }

    const preEventWall = [];
    let checkedInCount = 0;
    const signupsMap = {};

    preEventData.forEach(attendee => {
        if (attendee.aasm_state === 'checked_in') {
            checkedInCount++;
        }
        
        if (attendee.created_at) {
            const dateStr = attendee.created_at.split('T')[0];
            signupsMap[dateStr] = (signupsMap[dateStr] || 0) + 1;
        }

        if (attendee.submissions) {
            attendee.submissions.forEach(sub => {
                if (sub.review_state === 'approved') {
                    preEventWall.push({
                        name: attendee.name || 'Individual',
                        title: sub.title || 'Personal Site',
                        url: sub.live_url
                    });
                }
            });
        }
    });

    const sortedDates = Object.keys(signupsMap).sort();
    let cumulative = 0;
    const chartLabels = sortedDates;
    const chartValues = sortedDates.map(date => {
        cumulative += signupsMap[date];
        return cumulative;
    });

    const postEventWall = [];
    let totalRating = 0;
    let ratingCount = 0;
    const methodsCount = {};

    for (const response of postEventData) {
        let teamName = "Unknown Team";
        let membersRaw = "";
        let method = "";
        let link = "";
        let html = "", css = "", js = "";
        let zipUrl = "";

        response.questions.forEach(q => {
            if (q.name === "Team name") teamName = q.value;
            if (q.name === "Team member's names" && q.value) membersRaw = q.value;
            if (q.name === "How would you like to submit your website?") method = q.value;
            if (q.name === "Website link") link = q.value;
            if (q.name === "HTML" && q.value) html = q.value;
            if (q.name === "CSS" && q.value) css = q.value;
            if (q.name === "JavaScript" && q.value) js = q.value;
            if (q.name === "Upload your project (.zip)" && q.value && q.value.length > 0) zipUrl = q.value[0].url;
            if (q.name === "How was your experience on a scale of 1-10" && q.value !== null) {
                totalRating += Number(q.value);
                ratingCount++;
            }
        });

        if (!teamName) continue;

        if (method) {
            methodsCount[method] = (methodsCount[method] || 0) + 1;
        }

        const membersList = membersRaw
            ? membersRaw.split(/[\r\n]+/).map(m => m.trim()).filter(Boolean).join(', ')
            : '';

        let finalUrl = "#";
        const sanitizedTeamName = teamName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const teamDir = path.join(publicDir, sanitizedTeamName);

        if (method === "Link to my website" && link) {
            finalUrl = link;
        } 
        else if (method === "Upload a ZIP file" && zipUrl) {
            try {
                const zipBuffer = await downloadBuffer(zipUrl);
                const zip = new AdmZip(zipBuffer);
                
                if (!fs.existsSync(teamDir)) fs.mkdirSync(teamDir, { recursive: true });
                zip.extractAllTo(teamDir, true);
                
                normalizeZipFolder(teamDir);
                normalizeStylesheets(teamDir);

                finalUrl = `./${sanitizedTeamName}/index.html`;
            } catch (err) {
                finalUrl = zipUrl;
            }
        } 
        else if (method === "Paste HTML, CSS & JavaScript" && html) {
            finalUrl = `./${sanitizedTeamName}/index.html`;

            if (css) {
                if (!html.includes('style.css')) {
                    html = html.replace(/<link[^>]*href=["']([^"']+\.css)["'][^>]*>/gi, '');
                    if (html.includes('</head>')) {
                        html = html.replace('</head>', `<link rel="stylesheet" href="style.css">\n</head>`);
                    } else {
                        html = `<link rel="stylesheet" href="style.css">\n` + html;
                    }
                }
            }

            let jsName = 'script.js';
            const jsMatch = html.match(/<script[^>]*src=["']([^"']+\.js)["'][^>]*><\/script>/i);
            if (jsMatch) jsName = jsMatch[1];
            else if (js) {
                if (html.includes('</body>')) {
                    html = html.replace('</body>', `<script src="${jsName}"></script>\n</body>`);
                } else {
                    html += `\n<script src="${jsName}"></script>`;
                }
            }

            if (!fs.existsSync(teamDir)) fs.mkdirSync(teamDir, { recursive: true });
            fs.writeFileSync(path.join(teamDir, 'index.html'), html);
            if (css) fs.writeFileSync(path.join(teamDir, 'style.css'), css);
            if (js) fs.writeFileSync(path.join(teamDir, jsName), js);

            normalizeStylesheets(teamDir);
        }

        postEventWall.push({
            name: teamName,
            members: membersList,
            method: method,
            url: finalUrl
        });
    }

    const avgRating = ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : "N/A";
    let topMethod = "None";
    let maxCount = 0;
    for (const [m, c] of Object.entries(methodsCount)) {
        if (c > maxCount) {
            maxCount = c;
            topMethod = m.includes('Paste') ? 'Pasted Code' : m.includes('ZIP') ? 'ZIP Upload' : 'External Link';
        }
    }

    const dataPayload = {
        stats: {
            preCount: preEventWall.length,
            postCount: postEventWall.length,
            avgRating: avgRating,
            checkedIn: checkedInCount,
            topMethod: topMethod
        },
        chartData: {
            labels: chartLabels,
            values: chartValues
        },
        preEvent: preEventWall,
        postEvent: postEventWall
    };

    fs.writeFileSync(path.join(publicDir, 'data.json'), JSON.stringify(dataPayload, null, 2));

    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Boba Bash Lahore Wrapped</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Phantom+Sans:wght@400;700;800&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background-color: #cbebfa;
            background-image: 
                linear-gradient(rgba(180, 220, 240, 0.5) 1px, transparent 1px),
                linear-gradient(90deg, rgba(180, 220, 240, 0.5) 1px, transparent 1px);
            background-size: 30px 30px;
            font-family: 'Space Grotesk', system-ui, -apple-system, sans-serif;
            color: #252429;
            padding-bottom: 60px;
        }
        header {
            background: #fff;
            border-bottom: 2px solid #252429;
            padding: 12px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .flag {
            background: #ec3750;
            color: white;
            font-weight: 800;
            padding: 6px 14px;
            border-radius: 6px;
            text-decoration: none;
            font-size: 18px;
            letter-spacing: -0.5px;
            display: inline-block;
            transform: rotate(-2deg);
        }
        nav a {
            margin-left: 20px;
            text-decoration: none;
            color: #252429;
            font-weight: 700;
        }
        .btn-dash {
            background: #f1c40f;
            border: 2px solid #252429;
            padding: 6px 16px;
            border-radius: 6px;
            box-shadow: 2px 2px 0px #252429;
        }
        .main-layout {
            max-width: 1100px;
            margin: 40px auto;
            display: grid;
            grid-template-columns: 1fr;
            gap: 30px;
            padding: 0 20px;
        }
        .card {
            background: #fdfaf0;
            border: 2px solid #252429;
            border-radius: 8px;
            box-shadow: 5px 5px 0px #252429;
            padding: 30px;
        }
        h1 {
            color: #338da8;
            font-size: 42px;
            margin-bottom: 15px;
            line-height: 1.1;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 15px;
            margin: 25px 0 35px 0;
        }
        .stat-box {
            background: #fff;
            border: 2px solid #252429;
            padding: 15px;
            border-radius: 6px;
            text-align: center;
            box-shadow: 3px 3px 0px #252429;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
        .stat-number {
            font-size: 36px;
            font-weight: 800;
            color: #ec3750;
        }
        .stat-label {
            font-size: 13px;
            text-transform: uppercase;
            font-weight: 700;
            color: #555;
            margin-top: 4px;
        }
        .chart-container {
            background: #fff;
            border: 2px solid #252429;
            border-radius: 6px;
            padding: 20px;
            box-shadow: 4px 4px 0px #252429;
            margin-bottom: 40px;
        }
        h2 {
            font-size: 26px;
            border-bottom: 3px solid #f1c40f;
            display: inline-block;
            margin-bottom: 20px;
            margin-top: 10px;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        .submission-card {
            background: white;
            border: 2px solid #252429;
            border-radius: 6px;
            padding: 18px;
            box-shadow: 3px 3px 0px #252429;
            text-decoration: none;
            color: inherit;
            display: block;
            transition: transform 0.1s;
        }
        .submission-card:hover {
            transform: translate(-2px, -2px);
            box-shadow: 5px 5px 0px #252429;
        }
        .sub-name {
            font-size: 20px;
            font-weight: 700;
            color: #338da8;
            margin-bottom: 4px;
        }
        .sub-members {
            font-size: 14px;
            color: #666;
            margin-bottom: 10px;
            font-weight: 500;
        }
        .badge {
            display: inline-block;
            background: #e0f2fe;
            color: #0369a1;
            border: 1px solid #0284c7;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 700;
        }
    </style>
</head>
<body>
    <header>
        <a href="#" class="flag">HACK CLUB</a>
        <nav>
            <a href="#pre-wall">pre-event ships</a>
            <a href="#post-wall">day-of ships</a>
        </nav>
    </header>

    <div class="main-layout">
        <div class="card">
            <h1>Boba Bash Lahore Wrapped</h1>
            <p style="font-size: 18px; color: #444;">Make a website, hang out with friends, get free boba!</p>
            
            <div class="stats-grid">
                <div class="stat-box">
                    <div class="stat-number" id="checked-in-count">-</div>
                    <div class="stat-label">Total Checked In</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number" id="pre-count">-</div>
                    <div class="stat-label">Pre-Event Ships</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number" id="post-count">-</div>
                    <div class="stat-label">Day-Of Ships</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number" id="avg-rating">-</div>
                    <div class="stat-label">Avg NPS</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number" style="font-size:24px; padding-top:10px;" id="top-method">-</div>
                    <div class="stat-label">Top Submit Method</div>
                </div>
            </div>

            <div class="chart-container">
                <h2 style="border-bottom: 3px solid #ec3750; margin-top:0;">Cumulative Signups</h2>
                <canvas id="signupsChart" height="80"></canvas>
            </div>

            <h2 id="pre-wall">Pre-event ships</h2>
            <div class="grid" id="pre-wall-grid"></div>

            <h2 id="post-wall">Day-of ships</h2>
            <div class="grid" id="post-wall-grid"></div>
        </div>
    </div>

    <script>
        fetch('data.json')
            .then(res => res.json())
            .then(data => {
                document.getElementById('checked-in-count').innerText = data.stats.checkedIn;
                document.getElementById('pre-count').innerText = data.stats.preCount;
                document.getElementById('post-count').innerText = data.stats.postCount;
                document.getElementById('avg-rating').innerText = data.stats.avgRating + '/10';
                document.getElementById('top-method').innerText = data.stats.topMethod;

                const preWall = document.getElementById('pre-wall-grid');
                data.preEvent.forEach(item => {
                    const el = document.createElement('a');
                    el.className = 'submission-card';
                    el.href = item.url;
                    el.target = '_blank';
                    el.innerHTML = \`<div class="sub-name">\${item.name}</div><div class="badge">\${item.title}</div>\`;
                    preWall.appendChild(el);
                });

                const postWall = document.getElementById('post-wall-grid');
                data.postEvent.forEach(item => {
                    const el = document.createElement('a');
                    el.className = 'submission-card';
                    el.href = item.url;
                    el.target = item.url.startsWith('./') ? '_self' : '_blank';
                    const membersHtml = item.members ? \`<div class="sub-members">\${item.members}</div>\` : '';
                    el.innerHTML = \`<div class="sub-name">\${item.name}</div>\${membersHtml}<div class="badge">\${item.method.includes('Paste') ? 'Hosted locally' : item.method.includes('ZIP') ? 'Extracted ZIP' : 'External Link'}</div>\`;
                    postWall.appendChild(el);
                });

                const ctx = document.getElementById('signupsChart').getContext('2d');
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: data.chartData.labels,
                        datasets: [{
                            label: 'Total Signups',
                            data: data.chartData.values,
                            borderColor: '#ec3750',
                            backgroundColor: 'rgba(236, 55, 80, 0.1)',
                            borderWidth: 3,
                            fill: true,
                            tension: 0.3,
                            pointBackgroundColor: '#252429'
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            y: { beginAtZero: true, grid: { color: '#eee' } },
                            x: { grid: { display: false } }
                        }
                    }
                });
            });
    </script>
</body>
</html>`;

    fs.writeFileSync(path.join(publicDir, 'index.html'), indexHtml);
}

generateSite().catch(console.error);