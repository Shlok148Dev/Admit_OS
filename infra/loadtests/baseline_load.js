// Run with: docker run --rm -i --network=admitos_default grafana/k6 run - < infra/loadtests/baseline_load.js

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 5 },  // Ramp-up to 5 users
    { duration: '40s', target: 5 },  // Stay at 5 users
    { duration: '10s', target: 0 },  // Ramp-down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(99)<800'], // 99% of requests must be < 800ms (prediction SLA)
    http_req_failed: ['rate<0.01'],   // Less than 1% error rate
  },
};

const EXAMS = ['JEE_MAIN', 'NEET', 'MHT_CET'];
const CATEGORIES = ['GENERAL', 'OBC_NCL', 'SC', 'ST', 'EWS'];
const GENDERS = ['M', 'F'];
const STATES = ['MH', 'TN', 'KA', 'DL', 'UP'];

export default function () {
  const BASE_URL = __ENV.BASE_URL || 'http://admitos-prediction-service:8000';
  
  // Randomly generate request parameters to test both cached and uncached paths
  const exam = EXAMS[Math.floor(Math.random() * EXAMS.length)];
  const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  const gender = GENDERS[Math.floor(Math.random() * GENDERS.length)];
  const homeState = STATES[Math.floor(Math.random() * STATES.length)];
  const rank = Math.floor(Math.random() * 50000) + 1;
  const percentile = 100.0 - (rank / 500.0);

  const payload = JSON.stringify({
    exam: exam,
    rank: rank,
    percentile: Math.max(0, Math.min(100, percentile)),
    category: category,
    home_state: homeState,
    gender: gender,
    year: 2025,
    filters: {
      branches: ['CS', 'EC', 'ME', 'MBBS'],
      college_types: null,
      states: null,
      max_fees_per_year: null
    }
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const response = http.post(`${BASE_URL}/v1/predict/college`, payload, params);

  check(response, {
    'status is 200': (r) => r.status === 200,
    'has predictions': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body && Array.isArray(body.predictions);
      } catch (e) {
        return false;
      }
    },
  });

  sleep(1);
}
