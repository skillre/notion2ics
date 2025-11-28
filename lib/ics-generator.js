// 此文件保留用于URL生成以及全局导入

/**
 * 生成用于分享的唯一ICS文件URL
 * @param {string} baseUrl - 基本URL
 * @param {string} token - 访问令牌 (可选)
 * @param {string} personId - 人员ID (可选)
 * @returns {string} 分享URL
 */
export function generateShareUrl(baseUrl, token, personId) {
  // 移除尾部斜杠
  const baseUrlWithoutTrailingSlash = baseUrl.endsWith('/')
    ? baseUrl.slice(0, -1)
    : baseUrl;

  // 基本日历URL
  let calendarUrl = `${baseUrlWithoutTrailingSlash}/api/calendar`;

  const params = new URLSearchParams();

  if (token) {
    params.append('token', token);
  }

  if (personId) {
    params.append('personId', personId);
  }

  const queryString = params.toString();
  if (queryString) {
    calendarUrl += `?${queryString}`;
  }

  return calendarUrl;
} 