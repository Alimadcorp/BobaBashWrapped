const fs = require('fs');

function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = lines[i].split(',').map(v => v.trim());
        const row = {};
        headers.forEach((header, idx) => {
            row[header] = values[idx] || '';
        });
        rows.push(row);
    }
    return rows;
}

function stringifyCSV(headers, rows) {
    const headerLine = headers.join(',');
    const bodyLines = rows.map(row => 
        headers.map(h => {
            const val = row[h] || '';
            return val.includes(',') ? `"${val}"` : val;
        }).join(',')
    );
    return [headerLine, ...bodyLines].join('\n');
}

function runMerge() {
    const submissionsRaw = fs.readFileSync('submissions.json', 'utf8');
    const responsesRaw = fs.readFileSync('responses.json', 'utf8');
    const emailsCsvRaw = fs.readFileSync('emails.csv', 'utf8');

    const submissionsData = JSON.parse(submissionsRaw);
    const responsesData = JSON.parse(responsesRaw).responses;
    const csvRows = parseCSV(emailsCsvRaw);

    const emailPhoneMap = {};
    responsesData.forEach(resp => {
        let email = '';
        let phone = '';
        
        resp.questions.forEach(q => {
            if (q.name === "Email" && q.value) email = q.value.trim().toLowerCase();
            if (q.name === "Phone number" && q.value) phone = q.value.trim();
        });

        if (email && phone) {
            emailPhoneMap[email] = phone;
        }
    });

    const existingEmailsMap = new Map();
    csvRows.forEach(row => {
        if (row.EmailAddress) {
            existingEmailsMap.set(row.EmailAddress.trim().toLowerCase(), row);
        }
    });

    responsesData.forEach(resp => {
        let email = '';
        let phone = '';
        let name = '';

        resp.questions.forEach(q => {
            if (q.name === "Email" && q.value) email = q.value.trim().toLowerCase();
            if (q.name === "Phone number" && q.value) phone = q.value.trim();
            if (q.name === "Team member's names" && q.value) name = q.value.split(/[\r\n]+/)[0].trim();
        });

        if (email && !existingEmailsMap.has(email)) {
            const newRow = {
                FirstName: name || 'Participant',
                EmailAddress: email,
                PhoneNumber: phone
            };
            csvRows.push(newRow);
            existingEmailsMap.set(email, newRow);
        }
    });

    csvRows.forEach(row => {
        const cleanEmail = (row.EmailAddress || '').trim().toLowerCase();
        row.PhoneNumber = emailPhoneMap[cleanEmail] || row.PhoneNumber || '';
    });

    const updatedCsvContent = stringifyCSV(['FirstName', 'EmailAddress', 'PhoneNumber'], csvRows);
    fs.writeFileSync('emails.csv', updatedCsvContent);

    const allEmailsList = csvRows
        .map(r => r.EmailAddress ? r.EmailAddress.trim() : '')
        .filter(Boolean);
        
    const uniqueEmails = [...new Set(allEmailsList)];
    fs.writeFileSync('all_emails.csv', uniqueEmails.join(','));

    const checkedInNames = [];
    submissionsData.forEach(sub => {
        if (sub.aasm_state === 'checked_in' && sub.name) {
            checkedInNames.push(sub.name.trim());
        }
    });

    fs.writeFileSync('checked_in_participants.csv', checkedInNames.join('\n'));
}

runMerge();