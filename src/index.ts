/**
 * Feedback Analyzer - Cloudflare Workers Application
 * Aggregates and analyzes product feedback from multiple sources
 */

export interface Env {
	DB: D1Database;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// CORS headers for API access
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		};

		// Handle preflight requests
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		// ROUTE 1: Dashboard homepage
		if (url.pathname === '/' && request.method === 'GET') {
			return new Response(getDashboardHTML(), {
				headers: {...corsHeaders, 'Content-Type': 'text/html' },
			});
		}

		// ROUTE 2: Submit new feedback
		if (url.pathname === '/api/feedback' && request.method === 'POST') {
			return handleFeedbackSubmission(request, env, corsHeaders);
		}

		// ROUTE 3: Get insights/analytics
		if (url.pathname === '/api/insights' && request.method === 'GET') {
			return handleGetInsights(env, corsHeaders);
		}

		// 404 for unknown routes
		return new Response('Not Found', { status: 404, headers: corsHeaders });
	},
};

/**
 * Handle new feedback submission
 */
async function handleFeedbackSubmission(
	request: Request,
	env: Env,
	corsHeaders: Record<string, string>
): Promise<Response> {
	try {
		const body: any = await request.json();
		const { source, content } = body;

		if (!source || !content) {
			return new Response(JSON.stringify({ error: 'Source and content are required' }), {
				status: 400,
				headers: {...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		// Analyze the feedback
		const sentiment = analyzeSentiment(content);
		const category = categorize(content);
		const urgency = determineUrgency(content);

		// Save to database
		await env.DB.prepare(
			'INSERT INTO feedback (source, content, sentiment, category, urgency) VALUES (?, ?, ?, ?, ?)'
		).bind(source, content, sentiment, category, urgency).run();

		return new Response(
			JSON.stringify({
				success: true,
				sentiment,
				category,
				urgency,
				message: 'Feedback submitted successfully',
			}),
			{
				headers: {...corsHeaders, 'Content-Type': 'application/json' },
			}
		);
	} catch (error: any) {
		return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: {...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
}

/**
 * Get aggregated insights from feedback
 */
async function handleGetInsights(env: Env, corsHeaders: Record<string, string>): Promise<Response> {
	try {
		// Get sentiment breakdown
		const sentimentStats = await env.DB.prepare(
			'SELECT sentiment, COUNT(*) as count FROM feedback GROUP BY sentiment'
		).all();

		// Get category breakdown
		const categoryStats = await env.DB.prepare(
			'SELECT category, COUNT(*) as count FROM feedback GROUP BY category ORDER BY count DESC'
		).all();

		// Get urgency breakdown
		const urgencyStats = await env.DB.prepare(
			'SELECT urgency, COUNT(*) as count FROM feedback GROUP BY urgency'
		).all();

		// Get recent feedback
		const recentFeedback = await env.DB.prepare(
			'SELECT * FROM feedback ORDER BY created_at DESC LIMIT 10'
		).all();

		// Get total count
		const totalCount = await env.DB.prepare('SELECT COUNT(*) as total FROM feedback').first();

		const insights = {
			sentiment: sentimentStats.results,
			categories: categoryStats.results,
			urgency: urgencyStats.results,
			recent: recentFeedback.results,
			totalFeedback: totalCount?.total || 0,
		};

		return new Response(JSON.stringify(insights), {
			headers: {...corsHeaders, 'Content-Type': 'application/json' },
		});
	} catch (error: any) {
		return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: {...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
}

/**
 * Analyze sentiment based on keywords
 */
function analyzeSentiment(content: string): string {
	const positive = ['love', 'great', 'awesome', 'excellent', 'good', 'thank', 'perfect', 'amazing', 'fantastic'];
	const negative = ['broken', 'error', 'bug', 'issue', 'problem', 'slow', 'bad', 'terrible', 'hate', 'crash'];

	const lowerContent = content.toLowerCase();

	let positiveCount = 0;
	let negativeCount = 0;

	positive.forEach((word) => {
		if (lowerContent.includes(word)) positiveCount++;
	});

	negative.forEach((word) => {
		if (lowerContent.includes(word)) negativeCount++;
	});

	if (positiveCount > negativeCount) return 'POSITIVE';
	if (negativeCount > positiveCount) return 'NEGATIVE';
	return 'NEUTRAL';
}

/**
 * Categorize feedback into predefined categories
 */
function categorize(content: string): string {
	const lowerContent = content.toLowerCase();

	if (lowerContent.includes('bug') || lowerContent.includes('error') || lowerContent.includes('broken')) {
		return 'Bug';
	}
	if (lowerContent.includes('feature') || lowerContent.includes('request') || lowerContent.includes('add')) {
		return 'Feature Request';
	}
	if (lowerContent.includes('design') || lowerContent.includes('ui') || lowerContent.includes('ux')) {
		return 'UI/UX';
	}
	if (lowerContent.includes('docs') || lowerContent.includes('documentation') || lowerContent.includes('how')) {
		return 'Documentation';
	}
	if (lowerContent.includes('slow') || lowerContent.includes('performance') || lowerContent.includes('fast')) {
		return 'Performance';
	}

	return 'General';
}

/**
 * Determine urgency level
 */
function determineUrgency(content: string): string {
	const urgent = ['critical', 'urgent', 'broken', 'crash', 'down', 'not working', 'cannot', "can't"];
	const high = ['important', 'blocker', 'issue', 'problem', 'error'];

	const lowerContent = content.toLowerCase();

	if (urgent.some((word) => lowerContent.includes(word))) return 'Urgent';
	if (high.some((word) => lowerContent.includes(word))) return 'High';
	return 'Normal';
}

/**
 * Generate the HTML dashboard
 */
function getDashboardHTML(): string {
	return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Feedback Analyzer Dashboard</title>
  <style>
    * { 
      margin: 0; 
      padding: 0; 
      box-sizing: border-box; 
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }.container {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    h1 {
      color: white;
      text-align: center;
      margin-bottom: 10px;
      font-size: 2.5em;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
    }.subtitle {
      color: rgba(255,255,255,0.9);
      text-align: center;
      margin-bottom: 30px;
      font-size: 1.1em;
    }.feedback-form {
      background: white;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 30px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }.feedback-form h3 {
      color: #667eea;
      margin-bottom: 20px;
      font-size: 1.3em;
    }.form-group {
      margin-bottom: 16px;
    }
    
    label {
      display: block;
      margin-bottom: 8px;
      font-weight: 600;
      color: #333;
    }
    
    input, textarea, select {
      width: 100%;
      padding: 12px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 1em;
      font-family: inherit;
      transition: border-color 0.3s;
    }
    
    input:focus, textarea:focus, select:focus {
      outline: none;
      border-color: #667eea;
    }
    
    textarea {
      min-height: 100px;
      resize: vertical;
    }
    
    button {
      background: #667eea;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 1em;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
      width: 100%;
    }
    
    button:hover {
      background: #5568d3;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    
    button:active {
      transform: translateY(0);
    }.stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }.stat-card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      transition: transform 0.3s;
    }.stat-card:hover {
      transform: translateY(-5px);
    }.stat-card h3 {
      color: #667eea;
      margin-bottom: 16px;
      font-size: 1.2em;
      display: flex;
      align-items: center;
      gap: 8px;
    }.stat-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid #f0f0f0;
    }.stat-item:last-child {
      border-bottom: none;
    }.stat-label {
      font-weight: 500;
      color: #555;
    }.badge {
      background: #667eea;
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.9em;
      font-weight: 600;
    }.badge-positive {
      background: #10b981;
    }.badge-negative {
      background: #ef4444;
    }.badge-neutral {
      background: #6b7280;
    }.badge-urgent {
      background: #ef4444;
    }.badge-high {
      background: #f59e0b;
    }.badge-normal {
      background: #10b981;
    }.recent-feedback {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }.recent-feedback h3 {
      color: #667eea;
      margin-bottom: 20px;
      font-size: 1.3em;
    }.feedback-item {
      padding: 16px;
      border-left: 4px solid #667eea;
      background: #f8f9fa;
      margin-bottom: 12px;
      border-radius: 4px;
      transition: all 0.3s;
    }.feedback-item:hover {
      background: #e9ecef;
      transform: translateX(5px);
    }.feedback-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      flex-wrap: wrap;
      gap: 8px;
    }.feedback-source {
      font-weight: 600;
      color: #667eea;
    }.feedback-meta {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }.feedback-content {
      color: #333;
      line-height: 1.5;
      margin-bottom: 8px;
    }.loading {
      text-align: center;
      color: white;
      font-size: 1.2em;
      padding: 40px;
    }.success-message {
      background: #10b981;
      color: white;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 16px;
      display: none;
    }.success-message.show {
      display: block;
      animation: slideIn 0.3s ease-out;
    }
    
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }.total-count {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color:
	  white;
      text-align: center;
      padding: 20px;
      border-radius: 12px;
      margin-bottom: 30px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }.total-count h2 {
      font-size: 3em;
      margin-bottom: 5px;
    }.total-count p {
      font-size: 1.2em;
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Feedback Analyzer Dashboard</h1>
    <p class="subtitle">Aggregate and analyze product feedback from multiple sources</p>
    
    <div class="feedback-form">
      <h3>✍️ Submit New Feedback</h3>
      <div id="successMessage" class="success-message"></div>
      <form id="feedbackForm">
        <div class="form-group">
          <label for="source">Source:</label>
          <select id="source" required>
            <option value="">Select a source...</option>
            <option value="GitHub">GitHub</option>
            <option value="Discord">Discord</option>
            <option value="Support Ticket">Support Ticket</option>
            <option value="Email">Email</option>
            <option value="Twitter">Twitter</option>
            <option value="Community Forum">Community Forum</option>
          </select>
        </div>
        <div class="form-group">
          <label for="content">Feedback:</label>
          <textarea id="content" required placeholder="Enter feedback here..."></textarea>
        </div>
        <button type="submit">Submit Feedback</button>
      </form>
    </div>
    
    <div id="insights" class="loading">Loading insights...</div>
  </div>

  <script>
    // Load insights on page load
    loadInsights();
    
    // Auto-refresh insights every 30 seconds
    setInterval(loadInsights, 30000);
    
    // Load and display insights
    async function loadInsights() {
      try {
        const response = await fetch('/api/insights');
        const data = await response.json();
        
        let html = '';
        
        // Total feedback count
        html += \`
          <div class="total-count">
            <h2>\${data.totalFeedback}</h2>
            <p>Total Feedback Items</p>
          </div>
        \`;
        
        // Stats grid
        html += '<div class="stats-grid">';
        
        // Sentiment card
        html += '<div class="stat-card">';
        html += '<h3>😊 Sentiment Analysis</h3>';
        if (data.sentiment && data.sentiment.length > 0) {
          data.sentiment.forEach(item => {
            const badgeClass = item.sentiment === 'POSITIVE' ? 'badge-positive' : 
                               item.sentiment === 'NEGATIVE' ? 'badge-negative' : 'badge-neutral';
            html += \`
              <div class="stat-item">
                <span class="stat-label">\${item.sentiment}</span>
                <span class="badge \${badgeClass}">\${item.count}</span>
              </div>
            \`;
          });
        } else {
          html += '<p style="color: #999;">No sentiment data yet</p>';
        }
        html += '</div>';
        
        // Category card
        html += '<div class="stat-card">';
        html += '<h3>📁 Categories</h3>';
        if (data.categories && data.categories.length > 0) {
          data.categories.forEach(item => {
            html += \`
              <div class="stat-item">
                <span class="stat-label">\${item.category}</span>
                <span class="badge">\${item.count}</span>
              </div>
            \`;
          });
        } else {
          html += '<p style="color: #999;">No category data yet</p>';
        }
        html += '</div>';
        
        // Urgency card
        html += '<div class="stat-card">';
        html += '<h3>⚡ Urgency Levels</h3>';
        if (data.urgency && data.urgency.length > 0) {
          data.urgency.forEach(item => {
            const badgeClass = item.urgency === 'Urgent' ? 'badge-urgent' : 
                               item.urgency === 'High' ? 'badge-high' : 'badge-normal';
            html += \`
              <div class="stat-item">
                <span class="stat-label">\${item.urgency}</span>
                <span class="badge \${badgeClass}">\${item.count}</span>
              </div>
            \`;
          });
        } else {
          html += '<p style="color: #999;">No urgency data yet</p>';
        }
        html += '</div>';
        
        html += '</div>'; // End stats grid
        
        // Recent feedback
        html += '<div class="recent-feedback">';
        html += '<h3>📝 Recent Feedback</h3>';
        if (data.recent && data.recent.length > 0) {
          data.recent.forEach(item => {
            const sentimentBadge = item.sentiment === 'POSITIVE' ? 'badge-positive' : 
                                   item.sentiment === 'NEGATIVE' ? 'badge-negative' : 'badge-neutral';
            const urgencyBadge = item.urgency === 'Urgent' ? 'badge-urgent' : 
                                 item.urgency === 'High' ? 'badge-high' : 'badge-normal';
            
            html += \`
              <div class="feedback-item">
                <div class="feedback-header">
                  <span class="feedback-source">\${item.source}</span>
                  <div class="feedback-meta">
                    <span class="badge">\${item.category}</span>
                    <span class="badge \${sentimentBadge}">\${item.sentiment}</span>
                    <span class="badge \${urgencyBadge}">\${item.urgency}</span>
                  </div>
                </div>
                <p class="feedback-content">\${item.content}</p>
              </div>
            \`;
          });
        } else {
          html += '<p style="color: #999;">No feedback yet. Submit some feedback above!</p>';
        }
        html += '</div>';
        
        document.getElementById('insights').innerHTML = html;
      } catch (error) {
        console.error('Error loading insights:', error);
        document.getElementById('insights').innerHTML = 
          '<p style="color:white; text-align:center;">Error loading insights. Please refresh the page.</p>';
      }
    }
    
    // Handle feedback form submission
    document.getElementById('feedbackForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const source = document.getElementById('source').value;
      const content = document.getElementById('content').value;
      const submitButton = e.target.querySelector('button');
      const successMessage = document.getElementById('successMessage');
      
      // Disable button during submission
      submitButton.disabled = true;
      submitButton.textContent = 'Submitting...';
      
      try {
        const response = await fetch('/api/feedback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ source, content }),
        });
        
        const result = await response.json();
        
        if (result.success) {
          // Show success message
          successMessage.textContent = \`✅ Feedback submitted! Detected as \${result.sentiment} - \${result.category} (\${result.urgency} priority)\`;
          successMessage.classList.add('show');
          
          // Clear form
          document.getElementById('content').value = '';
          document.getElementById('source').value = '';
          
          // Reload insights
          setTimeout(() => {
            loadInsights();
            successMessage.classList.remove('show');
          }, 3000);
        } else {
          alert('Error submitting feedback: ' + (result.error || 'Unknown error'));
        }
      } catch (error) {
        console.error('Error submitting feedback:', error);
        alert('Error submitting feedback. Please try again.');
      } finally {
        // Re-enable button
        submitButton.disabled = false;
        submitButton.textContent = 'Submit Feedback';
      }
    });
  </script>
</body>
</html>
  `;
}