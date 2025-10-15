/**
 * Vegetarian Detection Utilities
 * 
 * This module provides intelligent vegetarian detection for meals and images
 * to ensure vegetarian meals are never mapped to non-vegetarian images.
 */

// Comprehensive lists of vegetarian and non-vegetarian indicators
const VEGETARIAN_INDICATORS = [
  // Proteins
  'paneer', 'tofu', 'soy', 'beans', 'lentils', 'dal', 'chickpeas', 'rajma', 'chana',
  'moong', 'masoor', 'urad', 'toor', 'black beans', 'kidney beans', 'white beans',
  'tempeh', 'seitan', 'quinoa', 'nuts', 'almonds', 'cashews', 'peanuts',
  
  // Vegetables
  'vegetable', 'veggie', 'potato', 'onion', 'tomato', 'carrot', 'spinach', 'palak',
  'cabbage', 'cauliflower', 'broccoli', 'peas', 'corn', 'bell pepper', 'capsicum',
  'eggplant', 'brinjal', 'okra', 'lady finger', 'bitter gourd', 'bottle gourd',
  'ridge gourd', 'snake gourd', 'pumpkin', 'sweet potato', 'beetroot', 'radish',
  'cucumber', 'lettuce', 'cabbage', 'mushroom', 'ginger', 'garlic', 'coriander',
  'mint', 'curry leaves', 'fenugreek', 'methi', 'dill', 'basil', 'oregano',
  
  // Grains and cereals
  'rice', 'wheat', 'flour', 'atta', 'maida', 'semolina', 'rava', 'sooji',
  'oats', 'barley', 'millet', 'bajra', 'jowar', 'ragi', 'corn flour',
  
  // Dairy (vegetarian)
  'milk', 'curd', 'yogurt', 'dahi', 'butter', 'ghee', 'cheese', 'cream',
  'buttermilk', 'lassi', 'paneer', 'cottage cheese',
  
  // Spices and seasonings
  'turmeric', 'cumin', 'coriander', 'cardamom', 'cinnamon', 'cloves', 'pepper',
  'chili', 'red chili', 'green chili', 'mustard', 'fenugreek', 'asafoetida',
  'hing', 'bay leaves', 'curry leaves', 'mint leaves', 'coriander leaves',
  
  // Cooking methods (typically vegetarian)
  'steamed', 'boiled', 'roasted', 'grilled', 'baked', 'stir-fried', 'sautéed',
  
  // Vegetarian dish names
  'vegetarian', 'veggie', 'vegan', 'sabzi', 'subzi', 'curry', 'masala', 'tikka',
  'biryani', 'pulao', 'fried rice', 'noodles', 'pasta', 'sandwich', 'wrap',
  'salad', 'soup', 'stew', 'gravy', 'sauce', 'chutney', 'pickle', 'raita',
  
  // Specific vegetarian dishes
  'dal', 'sambar', 'rasam', 'kadhi', 'korma', 'butter masala', 'tikka masala',
  'palak paneer', 'mutter paneer', 'chana masala', 'rajma masala', 'aloo gobi',
  'baingan bharta', 'aloo matar', 'mushroom curry', 'vegetable biryani',
  'paneer biryani', 'mushroom biryani', 'vegetable pulao', 'jeera rice',
  'coconut rice', 'lemon rice', 'tamarind rice', 'curd rice', 'bisi bele bath',
  'upma', 'poha', 'idli', 'dosa', 'uttapam', 'pancake', 'paratha', 'roti',
  'naan', 'kulcha', 'poori', 'chapati', 'phulka', 'thepla', 'methi thepla',
  'aloo paratha', 'gobi paratha', 'paneer paratha', 'onion paratha',
  
  // Fruits
  'apple', 'banana', 'orange', 'mango', 'grapes', 'strawberry', 'blueberry',
  'pineapple', 'papaya', 'guava', 'pomegranate', 'watermelon', 'muskmelon',
  'coconut', 'dates', 'figs', 'raisins', 'dry fruits', 'nuts',
  
  // Beverages
  'tea', 'coffee', 'milk', 'lassi', 'buttermilk', 'juice', 'smoothie',
  'lemonade', 'coconut water', 'tender coconut'
];

const NON_VEGETARIAN_INDICATORS = [
  // Meat types
  'chicken', 'mutton', 'lamb', 'beef', 'pork', 'duck', 'turkey', 'goat',
  'meat', 'flesh', 'protein', 'animal',
  
  // Fish and seafood
  'fish', 'salmon', 'tuna', 'prawn', 'shrimp', 'crab', 'lobster', 'oyster',
  'mussel', 'clam', 'squid', 'octopus', 'seafood', 'marine', 'sea food',
  
  // Eggs
  'egg', 'eggs', 'omelette', 'scrambled', 'boiled egg', 'fried egg',
  'egg curry', 'egg biryani', 'egg roll', 'egg sandwich',
  
  // Non-vegetarian dish names
  'non-vegetarian', 'non veg', 'nonveg', 'nonvegetarian', 'meat curry',
  'chicken curry', 'mutton curry', 'fish curry', 'prawn curry', 'egg curry',
  'chicken biryani', 'mutton biryani', 'fish biryani', 'prawn biryani',
  'egg biryani', 'chicken tikka', 'mutton tikka', 'fish tikka', 'prawn tikka',
  'chicken masala', 'mutton masala', 'fish masala', 'prawn masala',
  'chicken korma', 'mutton korma', 'fish korma', 'prawn korma',
  'chicken tandoori', 'mutton tandoori', 'fish tandoori', 'prawn tandoori',
  'chicken 65', 'mutton 65', 'fish 65', 'prawn 65', 'chicken lollipop',
  'mutton seekh', 'fish fry', 'prawn fry', 'chicken fry', 'mutton fry',
  'chicken roll', 'mutton roll', 'fish roll', 'prawn roll', 'egg roll',
  'chicken sandwich', 'mutton sandwich', 'fish sandwich', 'prawn sandwich',
  'egg sandwich', 'chicken burger', 'mutton burger', 'fish burger',
  'prawn burger', 'egg burger', 'chicken pizza', 'mutton pizza',
  'fish pizza', 'prawn pizza', 'egg pizza', 'chicken pasta', 'mutton pasta',
  'fish pasta', 'prawn pasta', 'egg pasta', 'chicken noodles', 'mutton noodles',
  'fish noodles', 'prawn noodles', 'egg noodles', 'chicken soup', 'mutton soup',
  'fish soup', 'prawn soup', 'egg soup', 'chicken stew', 'mutton stew',
  'fish stew', 'prawn stew', 'egg stew', 'chicken gravy', 'mutton gravy',
  'fish gravy', 'prawn gravy', 'egg gravy', 'chicken sauce', 'mutton sauce',
  'fish sauce', 'prawn sauce', 'egg sauce', 'chicken chutney', 'mutton chutney',
  'fish chutney', 'prawn chutney', 'egg chutney', 'chicken pickle', 'mutton pickle',
  'fish pickle', 'prawn pickle', 'egg pickle', 'chicken raita', 'mutton raita',
  'fish raita', 'prawn raita', 'egg raita',
  
  // Cooking methods with meat
  'grilled chicken', 'roasted chicken', 'baked chicken', 'fried chicken',
  'steamed fish', 'grilled fish', 'roasted fish', 'baked fish', 'fried fish',
  'grilled mutton', 'roasted mutton', 'baked mutton', 'fried mutton',
  'grilled prawn', 'roasted prawn', 'baked prawn', 'fried prawn',
  'grilled egg', 'roasted egg', 'baked egg', 'fried egg',
  
  // Specific non-vegetarian dishes
  'butter chicken', 'chicken tikka masala', 'mutton tikka masala',
  'fish tikka masala', 'prawn tikka masala', 'egg tikka masala',
  'chicken korma', 'mutton korma', 'fish korma', 'prawn korma', 'egg korma',
  'chicken vindaloo', 'mutton vindaloo', 'fish vindaloo', 'prawn vindaloo',
  'egg vindaloo', 'chicken jalfrezi', 'mutton jalfrezi', 'fish jalfrezi',
  'prawn jalfrezi', 'egg jalfrezi', 'chicken dopiaza', 'mutton dopiaza',
  'fish dopiaza', 'prawn dopiaza', 'egg dopiaza', 'chicken makhani',
  'mutton makhani', 'fish makhani', 'prawn makhani', 'egg makhani',
  'chicken kadai', 'mutton kadai', 'fish kadai', 'prawn kadai', 'egg kadai',
  'chicken chettinad', 'mutton chettinad', 'fish chettinad', 'prawn chettinad',
  'egg chettinad', 'chicken hyderabadi', 'mutton hyderabadi', 'fish hyderabadi',
  'prawn hyderabadi', 'egg hyderabadi', 'chicken kerala', 'mutton kerala',
  'fish kerala', 'prawn kerala', 'egg kerala', 'chicken goan', 'mutton goan',
  'fish goan', 'prawn goan', 'egg goan', 'chicken bengali', 'mutton bengali',
  'fish bengali', 'prawn bengali', 'egg bengali', 'chicken punjabi',
  'mutton punjabi', 'fish punjabi', 'prawn punjabi', 'egg punjabi',
  'chicken south indian', 'mutton south indian', 'fish south indian',
  'prawn south indian', 'egg south indian', 'chicken north indian',
  'mutton north indian', 'fish north indian', 'prawn north indian',
  'egg north indian', 'chicken west indian', 'mutton west indian',
  'fish west indian', 'prawn west indian', 'egg west indian',
  'chicken east indian', 'mutton east indian', 'fish east indian',
  'prawn east indian', 'egg east indian'
];

// Strong indicators that override other signals
const STRONG_VEGETARIAN_INDICATORS = [
  'vegetarian', 'veggie', 'vegan', 'pure veg', 'pure vegetarian',
  'sattvic', 'jain', 'brahmin', 'pure veg restaurant'
];

const STRONG_NON_VEGETARIAN_INDICATORS = [
  'non-vegetarian', 'non veg', 'nonveg', 'nonvegetarian', 'meat',
  'chicken', 'mutton', 'fish', 'prawn', 'egg', 'seafood', 'maas'
];

/**
 * Detect if a meal name is vegetarian based on text analysis
 */
function detectMealVegetarian(mealName, description) {
  if (!mealName) return true; // Default to vegetarian if uncertain
  
  const text = `${mealName} ${description || ''}`.toLowerCase();
  
  // Check for strong indicators first
  for (const indicator of STRONG_NON_VEGETARIAN_INDICATORS) {
    if (text.includes(indicator)) {
      return false;
    }
  }
  
  for (const indicator of STRONG_VEGETARIAN_INDICATORS) {
    if (text.includes(indicator)) {
      return true;
    }
  }
  
  // Count vegetarian vs non-vegetarian indicators
  let vegetarianScore = 0;
  let nonVegetarianScore = 0;
  
  for (const indicator of VEGETARIAN_INDICATORS) {
    if (text.includes(indicator)) {
      vegetarianScore++;
    }
  }
  
  for (const indicator of NON_VEGETARIAN_INDICATORS) {
    if (text.includes(indicator)) {
      nonVegetarianScore++;
    }
  }
  
  // If no indicators found, default to vegetarian (safer choice)
  if (vegetarianScore === 0 && nonVegetarianScore === 0) {
    return true;
  }
  
  // Return vegetarian if vegetarian score is higher or equal
  return vegetarianScore >= nonVegetarianScore;
}

/**
 * Detect if an image is vegetarian based on filename and description
 */
function detectImageVegetarian(imageUrl, imageName, description) {
  if (!imageUrl) return true; // Default to vegetarian if uncertain
  
  const text = `${imageUrl} ${imageName || ''} ${description || ''}`.toLowerCase();
  
  // Check for strong indicators first
  for (const indicator of STRONG_NON_VEGETARIAN_INDICATORS) {
    if (text.includes(indicator)) {
      return false;
    }
  }
  
  for (const indicator of STRONG_VEGETARIAN_INDICATORS) {
    if (text.includes(indicator)) {
      return true;
    }
  }
  
  // Count vegetarian vs non-vegetarian indicators
  let vegetarianScore = 0;
  let nonVegetarianScore = 0;
  
  for (const indicator of VEGETARIAN_INDICATORS) {
    if (text.includes(indicator)) {
      vegetarianScore++;
    }
  }
  
  for (const indicator of NON_VEGETARIAN_INDICATORS) {
    if (text.includes(indicator)) {
      nonVegetarianScore++;
    }
  }
  
  // If no indicators found, default to vegetarian (safer choice)
  if (vegetarianScore === 0 && nonVegetarianScore === 0) {
    return true;
  }
  
  // Return vegetarian if vegetarian score is higher or equal
  return vegetarianScore >= nonVegetarianScore;
}

/**
 * Validate vegetarian constraint between meal and image
 */
function validateVegetarianConstraint(
  mealName,
  mealDescription,
  imageUrl,
  imageName,
  imageDescription
) {
  const mealIsVegetarian = detectMealVegetarian(mealName, mealDescription);
  const imageIsVegetarian = detectImageVegetarian(imageUrl, imageName, imageDescription);
  
  // Vegetarian meal can only be mapped to vegetarian image
  // Non-vegetarian meal can be mapped to any image
  const isValid = !mealIsVegetarian || imageIsVegetarian;
  
  let reason = '';
  if (!isValid) {
    reason = `Vegetarian meal "${mealName}" cannot be mapped to non-vegetarian image "${imageUrl}"`;
  } else if (mealIsVegetarian && imageIsVegetarian) {
    reason = 'Both meal and image are vegetarian - valid match';
  } else if (!mealIsVegetarian && imageIsVegetarian) {
    reason = 'Non-vegetarian meal mapped to vegetarian image - valid match';
  } else {
    reason = 'Non-vegetarian meal mapped to non-vegetarian image - valid match';
  }
  
  return {
    isValid,
    mealIsVegetarian,
    imageIsVegetarian,
    reason
  };
}

/**
 * Filter images by vegetarian constraint
 */
function filterImagesByVegetarianConstraint(
  images,
  mealName,
  mealDescription
) {
  const mealIsVegetarian = detectMealVegetarian(mealName, mealDescription);
  
  return images.map(image => {
    const detectedVegetarian = detectImageVegetarian(
      image.url,
      image.name,
      image.description
    );
    
    // Use detected vegetarian status if not explicitly set
    const isVegetarian = image.isVegetarian !== undefined ? image.isVegetarian : detectedVegetarian;
    
    return {
      ...image,
      isVegetarian,
      detectedVegetarian
    };
  }).filter(image => {
    // Vegetarian meal can only be mapped to vegetarian image
    // Non-vegetarian meal can be mapped to any image
    return !mealIsVegetarian || image.isVegetarian;
  });
}

/**
 * Get vegetarian detection confidence score
 */
function getVegetarianConfidence(text, isVegetarian) {
  const lowerText = text.toLowerCase();
  let score = 0;
  let totalIndicators = 0;
  
  if (isVegetarian) {
    for (const indicator of VEGETARIAN_INDICATORS) {
      if (lowerText.includes(indicator)) {
        score++;
        totalIndicators++;
      }
    }
    
    // Check for strong indicators
    for (const indicator of STRONG_VEGETARIAN_INDICATORS) {
      if (lowerText.includes(indicator)) {
        score += 2; // Strong indicators get double weight
        totalIndicators += 2;
      }
    }
  } else {
    for (const indicator of NON_VEGETARIAN_INDICATORS) {
      if (lowerText.includes(indicator)) {
        score++;
        totalIndicators++;
      }
    }
    
    // Check for strong indicators
    for (const indicator of STRONG_NON_VEGETARIAN_INDICATORS) {
      if (lowerText.includes(indicator)) {
        score += 2; // Strong indicators get double weight
        totalIndicators += 2;
      }
    }
  }
  
  return totalIndicators > 0 ? score / totalIndicators : 0;
}

module.exports = {
  detectMealVegetarian,
  detectImageVegetarian,
  validateVegetarianConstraint,
  filterImagesByVegetarianConstraint,
  getVegetarianConfidence
};
