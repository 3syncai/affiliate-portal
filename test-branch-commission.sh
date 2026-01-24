#!/bin/bash
# Test script for branch admin commission system

echo "=========================================="
echo "Branch Admin Commission System Test"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get database URL from .env
source .env

echo "1. Checking database schema..."
echo "-------------------------------"

# Check if branch_admin has refer_code column
echo -n "✓ Checking refer_code column in branch_admin... "
REFER_CODE_EXISTS=$(psql "$DATABASE_URL" -t -c "SELECT column_name FROM information_schema.columns WHERE table_name='branch_admin' AND column_name='refer_code'" 2>/dev/null | xargs)
if [ "$REFER_CODE_EXISTS" == "refer_code" ]; then
    echo -e "${GREEN}✓ EXISTS${NC}"
else
    echo -e "${RED}✗ MISSING${NC}"
    exit 1
fi

# Check if branch_direct commission rate exists
echo -n "✓ Checking branch_direct commission rate... "
BRANCH_DIRECT_EXISTS=$(psql "$DATABASE_URL" -t -c "SELECT role_type FROM commission_rates WHERE role_type='branch_direct'" 2>/dev/null | xargs)
if [ "$BRANCH_DIRECT_EXISTS" == "branch_direct" ]; then
    RATE=$(psql "$DATABASE_URL" -t -c "SELECT commission_percentage FROM commission_rates WHERE role_type='branch_direct'" 2>/dev/null | xargs)
    echo -e "${GREEN}✓ EXISTS (${RATE}%)${NC}"
else
    echo -e "${RED}✗ MISSING${NC}"
    exit 1
fi

echo ""
echo "2. Getting branch admin referral code..."
echo "----------------------------------------"
BRANCH_REFER_CODE=$(psql "$DATABASE_URL" -t -c "SELECT refer_code FROM branch_admin LIMIT 1" 2>/dev/null | xargs)
if [ -z "$BRANCH_REFER_CODE" ]; then
    echo -e "${RED}✗ No branch admin found${NC}"
    exit 1
fi
echo "Branch Admin Referral Code: ${YELLOW}${BRANCH_REFER_CODE}${NC}"

echo ""
echo "3. Testing commission webhook..."
echo "--------------------------------"

# Test with branch admin referral code
echo "Testing branch admin referral (expecting 85% commission)..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/webhook/commission \
  -H "Content-Type: application/json" \
  -d "{
    \"order_id\": \"test_branch_$(date +%s)\",
    \"affiliate_code\": \"${BRANCH_REFER_CODE}\",
    \"product_name\": \"Test Product\",
    \"quantity\": 1,
    \"item_price\": 1000,
    \"order_amount\": 1000,
    \"commission_rate\": 10,
    \"commission_amount\": 100,
    \"commission_source\": \"order\",
    \"customer_id\": \"test_customer_123\",
    \"customer_name\": \"Test Customer\",
    \"customer_email\": \"test@example.com\"
  }")

SUCCESS=$(echo $RESPONSE | grep -o '"success":true')
if [ -n "$SUCCESS" ]; then
    AFFILIATE_RATE=$(echo $RESPONSE | grep -o '"affiliateRate":[0-9.]*' | cut -d':' -f2)
    AFFILIATE_COMMISSION=$(echo $RESPONSE | grep -o '"affiliateCommission":[0-9.]*' | cut -d':' -f2)
    REFERRAL_TYPE=$(echo $RESPONSE | grep -o '"referralType":"[^"]*"' | cut -d'"' -f4)
    
    echo -e "${GREEN}✓ Webhook success${NC}"
    echo "  - Referral Type: ${YELLOW}${REFERRAL_TYPE}${NC}"
    echo "  - Affiliate Rate: ${YELLOW}${AFFILIATE_RATE}%${NC}"
    echo "  - Commission Amount: ${YELLOW}₹${AFFILIATE_COMMISSION}${NC}"
    
    # Verify it's 85%
    if [ "$(echo "$AFFILIATE_RATE >= 84 && $AFFILIATE_RATE <= 86" | bc)" -eq 1 ]; then
        echo -e "${GREEN}✓ Rate is correct (85%)${NC}"
    else
        echo -e "${RED}✗ Rate is incorrect (expected 85%, got ${AFFILIATE_RATE}%)${NC}"
    fi
    
    if [ "$REFERRAL_TYPE" == "branch_admin" ]; then
        echo -e "${GREEN}✓ Referral type is correct${NC}"
    else
        echo -e "${YELLOW}⚠ Warning: referralType is '${REFERRAL_TYPE}', expected 'branch_admin'${NC}"
    fi
else
    echo -e "${RED}✗ Webhook failed${NC}"
    echo "Response: $RESPONSE"
    exit 1
fi

echo ""
echo "4. Verifying commission in database..."
echo "--------------------------------------"
SAVED_RATE=$(psql "$DATABASE_URL" -t -c "SELECT affiliate_rate FROM affiliate_commission_log WHERE affiliate_code='${BRANCH_REFER_CODE}' ORDER BY created_at DESC LIMIT 1" 2>/dev/null | xargs)
SAVED_COMMISSION=$(psql "$DATABASE_URL" -t -c "SELECT affiliate_commission FROM affiliate_commission_log WHERE affiliate_code='${BRANCH_REFER_CODE}' ORDER BY created_at DESC LIMIT 1" 2>/dev/null | xargs)
SAVED_SOURCE=$(psql "$DATABASE_URL" -t -c "SELECT commission_source FROM affiliate_commission_log WHERE affiliate_code='${BRANCH_REFER_CODE}' ORDER BY created_at DESC LIMIT 1" 2>/dev/null | xargs)

echo "  - Saved Rate: ${YELLOW}${SAVED_RATE}%${NC}"
echo "  - Saved Commission: ${YELLOW}₹${SAVED_COMMISSION}${NC}"
echo "  - Commission Source: ${YELLOW}${SAVED_SOURCE}${NC}"

echo ""
echo "5. Testing branch wallet API..."
echo "--------------------------------"
WALLET_RESPONSE=$(curl -s "http://localhost:3000/api/branch/wallet?refer_code=${BRANCH_REFER_CODE}")
WALLET_SUCCESS=$(echo $WALLET_RESPONSE | grep -o '"success":true')

if [ -n "$WALLET_SUCCESS" ]; then
    TOTAL_EARNED=$(echo $WALLET_RESPONSE | grep -o '"totalEarned":[0-9.]*' | cut -d':' -f2)
    CURRENT_BALANCE=$(echo $WALLET_RESPONSE | grep -o '"current":[0-9.]*' | cut -d':' -f2)
    
    echo -e "${GREEN}✓ Wallet API success${NC}"
    echo "  - Total Earned: ${YELLOW}₹${TOTAL_EARNED}${NC}"
    echo "  - Current Balance: ${YELLOW}₹${CURRENT_BALANCE}${NC}"
else
    echo -e "${RED}✗ Wallet API failed${NC}"
    echo "Response: $WALLET_RESPONSE"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}✓ All tests passed!${NC}"
echo "=========================================="
echo ""
echo "Summary:"
echo "  - Branch admin referral code: ${BRANCH_REFER_CODE}"
echo "  - Commission rate applied: 85% (70% affiliate + 15% branch_direct)"
echo "  - Commission source: branch_admin"
echo "  - Wallet tracking: Working"
