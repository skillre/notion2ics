// 此文件保留用于URL生成以及全局导入

/**
 * 生成用于分享的唯一ICS文件URL
 * @param {string} baseUrl - 基本URL
 * @param {string} token - 访问令牌 (可选)
 * @returns {string} 分享URL
 */
export function generateShareUrl(baseUrl, token) {
  // 移除尾部斜杠
  const baseUrlWithoutTrailingSlash = baseUrl.endsWith('/') 
    ? baseUrl.slice(0, -1) 
    : baseUrl;
  
  // 基本日历URL
  const calendarUrl = `${baseUrlWithoutTrailingSlash}/api/calendar`;
  
  // 如果提供了令牌，则添加到URL中
  if (token) {
    return `${calendarUrl}?token=${encodeURIComponent(token)}`;
  }
  
  return calendarUrl;
} 