// Simulate runtime collectionLink behavior
// Mock data from API
const items = [
  { id: 1, title: "Golden Residence", location: "Ташкент", price: "от $150,000" },
  { id: 2, title: "Golden Park", location: "Мирзо Улугбек", price: "от $72 000" },
];

// slugify function from runtime
function slugify(str) {
  var cyr = {'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'};
  return str.toLowerCase().split('').map(function(ch) { return cyr[ch] !== undefined ? cyr[ch] : ch; }).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 100);
}

// Simulate collectionLink logic
const config = {
  collectionLink: {
    basePath: "/projects",
    slugField: "slug",
    titleField: "title"
  }
};

function getNestedValue(obj, path) {
  return path.split('.').reduce(function(acc, key) { return acc && acc[key]; }, obj);
}

for (const item of items) {
  var rawSlug = getNestedValue(item, config.collectionLink.slugField);
  var titleVal = config.collectionLink.titleField ? getNestedValue(item, config.collectionLink.titleField) : '';
  var slugValue = rawSlug || (titleVal ? slugify(titleVal) : '') || item.id || item._id;
  var href = config.collectionLink.basePath + '/' + encodeURIComponent(String(slugValue)) + '.html';
  console.log(`${item.title}: rawSlug=${rawSlug}, titleVal=${titleVal}, slugValue=${slugValue}, href=${href}`);
}
