# Store Definitions: production

Generated: 2025-08-22T15:16:46.050Z

Found 25 metafield definitions and 2 metaobject definitions.

## Metafields

### another.metafield

- **Type:** collection_reference
- **Owner:** PRODUCT
- **Description:** Another ONE
- **Access:** Admin=PUBLIC_READ_WRITE, Storefront=NONE

### boolean.checkbox

- **Type:** boolean
- **Owner:** PRODUCT
- **Access:** Admin=PUBLIC_READ_WRITE, Storefront=NONE

### custom.article_metafield

- **Type:** rich_text_field
- **Owner:** ARTICLE
- **Access:** Admin=PUBLIC_READ_WRITE, Storefront=NONE

### custom.blog_metafield

- **Type:** weight
- **Owner:** BLOG
- **Access:** Admin=PUBLIC_READ_WRITE, Storefront=NONE

### custom.collection_metafield

- **Type:** number_integer
- **Owner:** COLLECTION
- **Description:** Collection metafield description
- **Access:** Admin=PUBLIC_READ_WRITE, Storefront=NONE

### custom.color

- **Type:** color
- **Owner:** PRODUCT
- **Access:** Admin=PUBLIC_READ_WRITE, Storefront=NONE

### custom.company_location_metafield

- **Type:** date
- **Owner:** COMPANY_LOCATION
- **Access:** Admin=PUBLIC_READ_WRITE, Storefront=NONE

### custom.company_metafield

- **Type:** date_time
- **Owner:** COMPANY
- **Access:** Admin=PUBLIC_READ_WRITE, Storefront=NONE

### custom.customer_metafield

- **Type:** number_decimal
- **Owner:** CUSTOMER
- **Access:** Admin=PUBLIC_READ_WRITE, Storefront=NONE

### custom.draft_order_metafield

- **Type:** file_reference
- **Owner:** DRAFTORDER
- **Access:** Admin=PUBLIC_READ_WRITE, Storefront=NONE
- **Validations:** file_type_options=["Image","Video"]

### custom.json

- **Type:** json
- **Owner:** PRODUCT
- **Access:** Admin=PUBLIC_READ_WRITE, Storefront=NONE

### custom.link

- **Type:** url
- **Owner:** PRODUCT
- **Access:** Admin=PUBLIC_READ_WRITE, Storefront=NONE

### custom.location_metafield

- **Type:** dimension
- **Owner:** LOCATION
- **Access:** Admin=PUBLIC_READ_WRITE, Storefront=NONE

### custom.market_metafield

- **Type:** company_reference
- **Owner:** MARKET
- **Access:** Admin=PUBLIC_READ_WRITE, Storefront=NONE

### custom.order_metafield

- **Type:** product_reference
- **Owner:** ORDER
- **Access:** Admin=PUBLIC_READ_WRITE, Storefront=NONE

### custom.page_metafield

- **Type:** volume
- **Owner:** PAGE
- **Access:** Admin=PUBLIC_READ_WRITE, Storefront=NONE

### custom.product_metafield

- **Type:** single_line_text_field
- **Owner:** PRODUCT
- **Access:** Admin=PUBLIC_READ_WRITE, Storefront=NONE

### custom.shop_metafield

- **Type:** customer_reference
- **Owner:** SHOP
- **Access:** Admin=PUBLIC_READ_WRITE, Storefront=NONE

### custom.star_rating

- **Type:** rating
- **Owner:** PRODUCT
- **Access:** Admin=PUBLIC_READ_WRITE, Storefront=NONE
- **Validations:** scale_min=1.0, scale_max=5.0

### custom.variant_metafield

- **Type:** multi_line_text_field
- **Owner:** PRODUCTVARIANT
- **Access:** Admin=PUBLIC_READ_WRITE, Storefront=NONE

### data.product_variant

- **Type:** variant_reference
- **Owner:** PRODUCT
- **Access:** Admin=PUBLIC_READ_WRITE, Storefront=NONE

### data.size_guide_page_list

- **Type:** list.page_reference
- **Owner:** PRODUCT
- **Description:** La liste
- **Access:** Admin=PUBLIC_READ_WRITE, Storefront=NONE

### ide.ide

- **Type:** id
- **Owner:** PRODUCT
- **Access:** Admin=PUBLIC_READ_WRITE, Storefront=NONE

### kebab-case.notUrl

- **Type:** link
- **Owner:** PRODUCT
- **Access:** Admin=PUBLIC_READ_WRITE, Storefront=NONE

### we_love.money

- **Type:** money
- **Owner:** PRODUCT
- **Access:** Admin=PUBLIC_READ_WRITE, Storefront=NONE

## Metaobjects

### font

- **Name:** Font
- **Description:** Font reference to be used in the "Typeface" metaobject entries
- **Fields:**
  - **name** (single_line_text_field) - Name used to reference the font
  - **asset_list** (list.file_reference) - Priority to web font formats (.woff and .woff2)
  - **style** (single_line_text_field)
  - **weight** (single_line_text_field)
- **Access:** Admin=PUBLIC_READ_WRITE, Storefront=NONE
- **Capabilities:** publishable, translatable

### theme_color

- **Name:** Theme color
- **Description:** Color reference to be used on the theme data/settings
- **Fields:**
  - **name** (single_line_text_field) - Name used to reference the theme color
  - **hex_code** (color) - The hex code associated with the color
- **Access:** Admin=PUBLIC_READ_WRITE, Storefront=NONE
- **Capabilities:** publishable, translatable

