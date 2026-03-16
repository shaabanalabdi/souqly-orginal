const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'frontend/src/pages/CreateListingPage.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

content = content.replace(
  "import { type FormEvent, useEffect, useMemo, useState } from 'react';",
  "import { type FormEvent, useEffect, useMemo, useState } from 'react';\nimport { useTranslation } from 'react-i18next';"
);
content = content.replace(
  "export function CreateListingPage() {\n  const [form, setForm] = useState<ListingFormState>(initialFormState);",
  "export function CreateListingPage() {\n  const { t } = useTranslation('createListing');\n  const [form, setForm] = useState<ListingFormState>(initialFormState);"
);

content = content.replace(
  "setError('Please select at least one image file.');",
  "setError(t('errorNoImages'));"
);
content = content.replace(
  "setSuccessMessage(`${urls.length} image(s) uploaded successfully.`);",
  "setSuccessMessage(t('imagesUploadedMsg', { count: urls.length }));"
);
content = content.replace(
  "setError('At least one image is required. Upload files or add manual URLs.');",
  "setError(t('errorAtLeastOneImage'));"
);
content = content.replace(
  "setSuccessMessage(\n        `Listing #${createdListing.id} submitted successfully with status ${createdListing.status}.`,\n      );",
  "setSuccessMessage(\n        t('listingSubmittedMsg', { listingId: createdListing.id, status: createdListing.status })\n      );"
);

content = content.replace('<h1 className="page-title">Create Listing</h1>', '<h1 className="page-title">{t(\'title\')}</h1>');
content = content.replace('<p className="page-subtitle">Submit a new classified ad with real image upload support.</p>', '<p className="page-subtitle">{t(\'subtitle\')}</p>');

content = content.replace('<span className="label">Category</span>', '<span className="label">{t(\'category\')}</span>');
content = content.replace('<option value="">Select category</option>', '<option value="">{t(\'selectCategory\')}</option>');

content = content.replace('<span className="label">Subcategory</span>', '<span className="label">{t(\'subcategory\')}</span>');
content = content.replace('<option value="">Select subcategory</option>', '<option value="">{t(\'selectSubcategory\')}</option>');

content = content.replace('<span className="label">Condition</span>', '<span className="label">{t(\'condition\')}</span>');
content = content.replace('<option value="">Not specified</option>', '<option value="">{t(\'notSpecified\')}</option>');

content = content.replace('<span className="label">Country</span>', '<span className="label">{t(\'country\')}</span>');
content = content.replace('<option value="">Select country</option>', '<option value="">{t(\'selectCountry\')}</option>');

content = content.replace('<span className="label">City</span>', '<span className="label">{t(\'city\')}</span>');
content = content.replace('<option value="">Select city</option>', '<option value="">{t(\'selectCity\')}</option>');

content = content.replace('<span className="label">Currency</span>', '<span className="label">{t(\'currency\')}</span>');
content = content.replace('<span className="label">Price</span>', '<span className="label">{t(\'price\')}</span>');
content = content.replace('<span className="label">Arabic title</span>', '<span className="label">{t(\'arabicTitle\')}</span>');
content = content.replace('<span className="label">English title (optional)</span>', '<span className="label">{t(\'englishTitleOptional\')}</span>');
content = content.replace('<span className="label">Arabic description</span>', '<span className="label">{t(\'arabicDescription\')}</span>');
content = content.replace('<span className="label">English description (optional)</span>', '<span className="label">{t(\'englishDescriptionOptional\')}</span>');

content = content.replace('<h3>Images</h3>', '<h3>{t(\'images\')}</h3>');
content = content.replace('<p className="muted-text">Upload image files to S3 or add manual URLs as fallback.</p>', '<p className="muted-text">{t(\'imagesHelpText\')}</p>');
content = content.replace('<span className="label">Select image files (max 10, 8MB each)</span>', '<span className="label">{t(\'selectImageFiles\')}</span>');
content = content.replace(
  "{uploadingImages ? 'Uploading...' : 'Upload selected images'}",
  "{uploadingImages ? t('uploading') : t('uploadSelectedImages')}"
);
content = content.replace('>\n                      Remove\n                    </button>', '>\n                      {t(\'remove\')}\n                    </button>');
content = content.replace('<p className="muted-text">No uploaded images yet.</p>', '<p className="muted-text">{t(\'noUploadedImages\')}</p>');
content = content.replace('<span className="label">Manual image URLs (optional, one per line)</span>', '<span className="label">{t(\'manualImageUrls\')}</span>');

content = content.replace('<h3>Dynamic Attributes</h3>', '<h3>{t(\'dynamicAttributes\')}</h3>');
content = content.replace('>\n            Negotiable\n          </label>', '>\n            {t(\'negotiable\')}\n          </label>');
content = content.replace('>\n            Phone visible\n          </label>', '>\n            {t(\'phoneVisible\')}\n          </label>');
content = content.replace('>\n            WhatsApp visible\n          </label>', '>\n            {t(\'whatsappVisible\')}\n          </label>');

content = content.replace(
  "Listing reference: #{createdListingId}. Public details page only works when status becomes ACTIVE.",
  "{t('listingReference', { listingId: createdListingId })}"
);
content = content.replace(
  "{loading ? 'Submitting...' : 'Submit listing'}",
  "{loading ? t('submitting') : t('submitListing')}"
);
content = content.replace(
  ">\n            Cancel\n          </Link>",
  ">\n            {t('cancel')}\n          </Link>"
);

fs.writeFileSync(targetFile, content, 'utf8');
console.log('CreateListingPage.tsx updated successfully');
