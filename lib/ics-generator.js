// 此文件保留用于URL生成以及全局导入

/**
 * 生成用于分享的唯一ICS文件URL
 * @param {string} baseUrl - 基本URL
 * @returns {string} 分享URL
 */
export function generateShareUrl(baseUrl) {
  // 移除尾部斜杠
  const baseUrlWithoutTrailingSlash = baseUrl.endsWith('/') 
    ? baseUrl.slice(0, -1) 
    : baseUrl;
  
  return `${baseUrlWithoutTrailingSlash}/api/calendar`;
} 