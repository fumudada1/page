/* 圖片清單（共 32 張）
 * 想換成免費圖庫照片（Unsplash / Pixabay / Pexels）：
 * 下載後放進 images/ 資料夾，把 src 改成檔名即可。建議正方形、至少 800x800。
 * 目前使用的是自製插圖（CC0，可自由使用）。 */
/* 首頁的分類（名稱統一四個字）。圖片用 cat 對應；'all' 代表全部 */
window.PUZZLE_CATEGORIES = [
  { id: 'all',     icon: '🌈', name: '全部圖片' },
  { id: 'animal',  icon: '🐻', name: '可愛動物' },
  { id: 'fruit',   icon: '🍎', name: '水果甜點' },
  { id: 'nature',  icon: '🌻', name: '美麗自然' },
  { id: 'vehicle', icon: '🚗', name: '交通工具' },
  { id: 'life',    icon: '🏠', name: '日常生活' }
];

window.PUZZLE_IMAGES = [
  { id: 'cat', cat: 'animal',        name: '貓咪',   src: 'images/cat.svg',        credit: '自製插圖 CC0' },
  { id: 'dog', cat: 'animal',        name: '小狗',   src: 'images/dog.svg',        credit: '自製插圖 CC0' },
  { id: 'rabbit', cat: 'animal',     name: '兔子',   src: 'images/rabbit.svg',     credit: '自製插圖 CC0' },
  { id: 'fish', cat: 'animal',       name: '小魚',   src: 'images/fish.svg',       credit: '自製插圖 CC0' },
  { id: 'duck', cat: 'animal',       name: '小鴨',   src: 'images/duck.svg',       credit: '自製插圖 CC0' },
  { id: 'butterfly', cat: 'animal',  name: '蝴蝶',   src: 'images/butterfly.svg',  credit: '自製插圖 CC0' },
  { id: 'apple', cat: 'fruit',      name: '蘋果',   src: 'images/apple.svg',      credit: '自製插圖 CC0' },
  { id: 'strawberry', cat: 'fruit', name: '草莓',   src: 'images/strawberry.svg', credit: '自製插圖 CC0' },
  { id: 'flower', cat: 'nature',     name: '花朵',   src: 'images/flower.svg',     credit: '自製插圖 CC0' },
  { id: 'sun', cat: 'nature',        name: '太陽',   src: 'images/sun.svg',        credit: '自製插圖 CC0' },
  { id: 'car', cat: 'vehicle',        name: '汽車',   src: 'images/car.svg',        credit: '自製插圖 CC0' },
  { id: 'house', cat: 'life',      name: '房子',   src: 'images/house.svg',      credit: '自製插圖 CC0' },
  { id: 'bear', cat: 'animal', name: '小熊', src: 'images/bear.svg', credit: '自製插圖 CC0' },
  { id: 'pig', cat: 'animal', name: '小豬', src: 'images/pig.svg', credit: '自製插圖 CC0' },
  { id: 'frog', cat: 'animal', name: '青蛙', src: 'images/frog.svg', credit: '自製插圖 CC0' },
  { id: 'penguin', cat: 'animal', name: '企鵝', src: 'images/penguin.svg', credit: '自製插圖 CC0' },
  { id: 'panda', cat: 'animal', name: '熊貓', src: 'images/panda.svg', credit: '自製插圖 CC0' },
  { id: 'lion', cat: 'animal', name: '獅子', src: 'images/lion.svg', credit: '自製插圖 CC0' },
  { id: 'turtle', cat: 'animal', name: '烏龜', src: 'images/turtle.svg', credit: '自製插圖 CC0' },
  { id: 'owl', cat: 'animal', name: '貓頭鷹', src: 'images/owl.svg', credit: '自製插圖 CC0' },
  { id: 'elephant', cat: 'animal', name: '大象', src: 'images/elephant.svg', credit: '自製插圖 CC0' },
  { id: 'bird', cat: 'animal', name: '小鳥', src: 'images/bird.svg', credit: '自製插圖 CC0' },
  { id: 'banana', cat: 'fruit', name: '香蕉', src: 'images/banana.svg', credit: '自製插圖 CC0' },
  { id: 'orange', cat: 'fruit', name: '橘子', src: 'images/orange.svg', credit: '自製插圖 CC0' },
  { id: 'watermelon', cat: 'fruit', name: '西瓜', src: 'images/watermelon.svg', credit: '自製插圖 CC0' },
  { id: 'grapes', cat: 'fruit', name: '葡萄', src: 'images/grapes.svg', credit: '自製插圖 CC0' },
  { id: 'rainbow', cat: 'nature', name: '彩虹', src: 'images/rainbow.svg', credit: '自製插圖 CC0' },
  { id: 'tree', cat: 'nature', name: '大樹', src: 'images/tree.svg', credit: '自製插圖 CC0' },
  { id: 'boat', cat: 'vehicle', name: '帆船', src: 'images/boat.svg', credit: '自製插圖 CC0' },
  { id: 'balloon', cat: 'life', name: '氣球', src: 'images/balloon.svg', credit: '自製插圖 CC0' },
  { id: 'rocket', cat: 'vehicle', name: '火箭', src: 'images/rocket.svg', credit: '自製插圖 CC0' },
  { id: 'icecream', cat: 'fruit', name: '冰淇淋', src: 'images/icecream.svg', credit: '自製插圖 CC0' }
];
