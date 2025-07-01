import { Mcp, Tool, ToolConfig, ToolResult } from '@modelcontextprotocol/sdk';

interface FashionItem {
  id: string;
  name: string;
  style: string;
  color: string;
  price: number;
  rating: number;
  imageUrl: string;
}

class FashionRecommendationTool implements Tool {
  readonly name = 'fashion_recommendation';
  readonly description = 'Recommend fashionable clothing items based on style and color preferences';
  readonly parameters = {
    type: 'object',
    properties: {
      preferredStyle: {
        type: 'string',
        enum: ['casual', 'formal', 'sporty', 'bohemian', 'vintage'],
        description: 'Preferred clothing style'
      },
      preferredColor: {
        type: 'string',
        description: 'Preferred color for clothing'
      },
      maxPrice: {
        type: 'number',
        description: 'Maximum price willing to pay'
      }
    },
    required: ['preferredStyle']
  };

  private fashionItems: FashionItem[] = [
    {
      id: '1',
      name: 'Classic White Shirt',
      style: 'formal',
      color: 'white',
      price: 59.99,
      rating: 4.8,
      imageUrl: 'https://example.com/shirt1.jpg'
    },
    {
      id: '2',
      name: 'Denim Jacket',
      style: 'casual',
      color: 'blue',
      price: 89.99,
      rating: 4.5,
      imageUrl: 'https://example.com/jacket1.jpg'
    },
    {
      id: '3',
      name: 'Yoga Pants',
      style: 'sporty',
      color: 'black',
      price: 39.99,
      rating: 4.7,
      imageUrl: 'https://example.com/pants1.jpg'
    },
    {
      id: '4',
      name: 'Floral Summer Dress',
      style: 'bohemian',
      color: 'multicolor',
      price: 79.99,
      rating: 4.9,
      imageUrl: 'https://example.com/dress1.jpg'
    },
    {
      id: '5',
      name: 'Retro Sunglasses',
      style: 'vintage',
      color: 'brown',
      price: 29.99,
      rating: 4.3,
      imageUrl: 'https://example.com/glasses1.jpg'
    }
  ];

  async execute(input: any): Promise<ToolResult> {
    const { preferredStyle, preferredColor, maxPrice } = input;
    
    if (!preferredStyle) {
      throw new Error('Preferred style is required');
    }

    let recommendations = this.fashionItems.filter(item => 
      item.style === preferredStyle
    );

    if (preferredColor) {
      recommendations = recommendations.filter(item => 
        item.color.toLowerCase().includes(preferredColor.toLowerCase())
      );
    }

    if (maxPrice) {
      recommendations = recommendations.filter(item => item.price <= maxPrice);
    }

    recommendations.sort((a, b) => b.rating - a.rating);

    return {
      success: true,
      output: {
        recommendations,
        count: recommendations.length
      }
    };
  }
}

const fashionService = new Mcp('fashion', {
  name: 'Fashion Recommendation Service',
  description: 'Helps users find good looking clothes based on their preferences',
  tools: [new FashionRecommendationTool()]
});

async function main() {
  try {
    await fashionService.start();
    console.log('Fashion service started successfully');
  } catch (error) {
    console.error('Failed to start fashion service:', error);
    process.exit(1);
  }
}

main();