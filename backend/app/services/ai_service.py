import httpx
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"


class AISecurityInspector:
    """
    AI-powered security analysis using Claude.
    Analyzes audit logs, security findings, and user behavior.
    """

    def __init__(self):
        self.model = "claude-sonnet-4-20250514"
        self.max_tokens = 2048

    async def analyze_security_posture(
        self,
        audit_summary: Dict[str, Any],
        findings: List[Dict],
        stats: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Analyze overall security posture."""
        prompt = f"""You are a senior cybersecurity architect analyzing a secure file sharing platform called SecureVault.

Current Platform Statistics:
- Total Users: {stats.get('total_users', 0)}
- Total Files: {stats.get('total_files', 0)}
- Active Shares: {stats.get('active_shares', 0)}
- Infected Files: {stats.get('infected_files', 0)}
- Quarantined Files: {stats.get('quarantined_files', 0)}
- Critical Security Findings: {stats.get('critical_findings', 0)}

Recent Activity Summary (last 7 days):
{json.dumps(audit_summary, indent=2, default=str)}

Open Security Findings:
{json.dumps(findings[:10], indent=2, default=str)}

Please provide:
1. Overall security risk score (0-100, higher = worse)
2. Top 3 security concerns
3. Immediate recommended actions (3-5 items)
4. Positive security controls in place
5. One-paragraph executive summary

Respond in JSON format with keys: risk_score, concerns, recommendations, positive_controls, summary
"""

        return await self._call_claude(prompt)

    async def analyze_suspicious_activity(
        self,
        user_activity: List[Dict],
        user_info: Dict,
    ) -> Dict[str, Any]:
        """Analyze user activity for suspicious patterns."""
        prompt = f"""You are a cybersecurity analyst investigating potential insider threats and account compromise.

User Profile:
{json.dumps(user_info, indent=2, default=str)}

Recent Activity (last 30 days):
{json.dumps(user_activity[:50], indent=2, default=str)}

Analyze this activity for:
1. Unusual access patterns (time, volume, file types)
2. Signs of account compromise
3. Data exfiltration indicators
4. Policy violations
5. Risk level (low/medium/high/critical)

Respond in JSON with keys: risk_level, anomalies, indicators, verdict, recommended_actions
"""
        return await self._call_claude(prompt)

    async def analyze_file_security(
        self,
        file_info: Dict,
        scan_history: List[Dict],
    ) -> Dict[str, Any]:
        """Analyze a file's security characteristics."""
        prompt = f"""You are a malware analyst reviewing a file uploaded to a secure document platform.

File Information:
{json.dumps(file_info, indent=2, default=str)}

Scan History:
{json.dumps(scan_history, indent=2, default=str)}

Assess:
1. Potential risk based on file type and metadata
2. Scan result interpretation
3. Recommended handling
4. Whether file should be quarantined

Respond in JSON with keys: risk_assessment, scan_interpretation, recommendation, should_quarantine, notes
"""
        return await self._call_claude(prompt)

    async def generate_security_report(
        self,
        period_days: int,
        all_stats: Dict,
        top_findings: List[Dict],
        activity_summary: Dict,
    ) -> str:
        """Generate a narrative security report."""
        prompt = f"""You are a CISO writing a {period_days}-day security summary report for SecureVault.

Platform Stats:
{json.dumps(all_stats, indent=2, default=str)}

Top Security Findings:
{json.dumps(top_findings[:5], indent=2, default=str)}

Activity Summary:
{json.dumps(activity_summary, indent=2, default=str)}

Write a professional security report with:
- Executive Summary
- Key Metrics
- Notable Security Events
- Risk Assessment
- Recommended Next Steps

Use markdown formatting. Be concise but thorough (300-500 words).
"""
        result = await self._call_claude(prompt, raw_text=True)
        return result

    async def _call_claude(
        self,
        prompt: str,
        raw_text: bool = False,
    ) -> Any:
        """Call Claude API for analysis."""
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.post(
                    ANTHROPIC_API_URL,
                    headers={
                        "Content-Type": "application/json",
                        "anthropic-version": "2023-06-01",
                    },
                    json={
                        "model": self.model,
                        "max_tokens": self.max_tokens,
                        "messages": [{"role": "user", "content": prompt}],
                    },
                )

                if response.status_code != 200:
                    logger.error(f"Claude API error: {response.status_code} - {response.text}")
                    return self._fallback_response(raw_text)

                data = response.json()
                text = data["content"][0]["text"]

                if raw_text:
                    return text

                # Parse JSON response
                text = text.strip()
                if text.startswith("```json"):
                    text = text[7:]
                if text.startswith("```"):
                    text = text[3:]
                if text.endswith("```"):
                    text = text[:-3]

                return json.loads(text.strip())

        except Exception as e:
            logger.error(f"AI analysis error: {e}")
            return self._fallback_response(raw_text)

    def _fallback_response(self, raw_text: bool) -> Any:
        if raw_text:
            return "AI analysis temporarily unavailable. Please review security findings manually."
        return {
            "risk_score": 0,
            "concerns": ["AI analysis unavailable"],
            "recommendations": ["Review security findings manually"],
            "positive_controls": ["Platform operational"],
            "summary": "AI analysis service is temporarily unavailable.",
            "error": True,
        }


ai_inspector = AISecurityInspector()
