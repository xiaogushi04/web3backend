import asyncio
import aiohttp
import json
from datetime import datetime
from eth_account import Account
from eth_account.messages import encode_defunct
import time
import random
import psutil
import os
from web3 import Web3

# 测试账户私钥列表
PRIVATE_KEYS = [
    "0xb1ff6f9e61d84dc342ce559cb7e5cb1292fe7c8023f0c428d72a670a00862dd0",
    "0x99c85d62f6585c1d7efbaecff843dfded4acb64adf42089347a298d61cc1a1da",
    "0x502f0361313a5c5a84ce00a282c7ec2386bd71c248a0203d534c0d19f9ad0137",
    "0xc28eb395ce371894ce672d4d4b3dc3c4f2947e90f1624a9da4fb56fce303aece",
    "0xbb0ccc111c5af4a6da618eb426595b5a73520548560b5a664ce939128925192c",
    "0xdc00fa42451828cb7b85d8f9f8f804ef58cdf7f6987a396275b0f861116e1b71",
    "0x8d4db7f34c68de60eb743f36a8d4ec98ee7b009ac2937525f4100c6aa5231221",
    "0xa672b45f5052407dcd1ba20c778030acaa5694bd75c3f4ea305e01738a25380e",
    "0xe684f4c75315a68db9dd05800cf22a3c23f64662c655f82a6410ee1480bdd8e4"
]

# 资源ID列表
RESOURCE_IDS = ["1", "2", "4", "5", "6", "7", "8"]

# Web3配置
w3 = Web3(Web3.HTTPProvider('http://localhost:7545'))

async def check_resource_config(session, resource_id):
    """检查资源访问权配置"""
    try:
        async with session.get(f"http://localhost:3000/api/contracts/access/config/{resource_id}") as response:
            if response.status == 200:
                config = await response.json()
                if config.get('success') and config.get('data'):
                    return config['data']
                return None
            return None
    except Exception as e:
        print(f"检查资源配置失败: {str(e)}")
        return None

async def check_account_balance(address):
    """检查账户余额"""
    try:
        balance = w3.eth.get_balance(address)
        return w3.from_wei(balance, 'ether')
    except Exception as e:
        print(f"检查账户余额失败: {str(e)}")
        return 0

async def buy_access_token(session, private_key, resource_id, user_id, round_num, max_retries=3):
    """单个用户购买访问权"""
    for retry in range(max_retries):
        try:
            account = Account.from_key(private_key)
            user_address = account.address

            # 检查账户余额
            balance = await check_account_balance(user_address)
            if balance < 0.1:  # 确保至少有0.1 ETH
                return {
                    "user_id": user_id,
                    "resource_id": resource_id,
                    "round": round_num,
                    "status": "error",
                    "error": f"账户余额不足: {balance} ETH"
                }

            # 检查资源配置
            config = await check_resource_config(session, resource_id)
            if not config or not config.get('isActive'):
                return {
                    "user_id": user_id,
                    "resource_id": resource_id,
                    "round": round_num,
                    "status": "error",
                    "error": "资源未激活或配置不存在"
                }

            # 购买参数
            duration = 3600  # 秒
            max_uses = 10
            price = int(config['price'])

            # 获取当前nonce
            nonce = w3.eth.get_transaction_count(user_address)
            
            # 构造签名消息
            message = f"Buy Access Token for resource {resource_id} at {int(time.time())} nonce:{nonce}"
            message_encoded = encode_defunct(text=message)
            signed_message = Account.sign_message(message_encoded, private_key=private_key)
            signature = "0x" + signed_message.signature.hex()

            # 请求体
            payload = {
                "resourceId": resource_id,
                "duration": duration,
                "maxUses": max_uses,
                "message": message,
                "address": user_address
            }
            headers = {
                "x-signature": signature,
                "x-user-address": user_address
            }

            # 增加随机延迟（1-2秒）
            await asyncio.sleep(random.uniform(1, 2))

            # 发送请求
            start_time = time.time()
            async with session.post(
                "http://localhost:3000/api/contracts/access/buy",
                json=payload,
                headers=headers
            ) as response:
                end_time = time.time()
                response_time = end_time - start_time
                
                if response.status == 200:
                    result = await response.json()
                    return {
                        "user_id": user_id,
                        "resource_id": resource_id,
                        "round": round_num,
                        "status": "success",
                        "response_time": response_time,
                        "data": result
                    }
                else:
                    error_text = await response.text()
                    if retry < max_retries - 1:
                        await asyncio.sleep(2)
                        continue
                    return {
                        "user_id": user_id,
                        "resource_id": resource_id,
                        "round": round_num,
                        "status": "error",
                        "response_time": response_time,
                        "error": f"HTTP {response.status}: {error_text}"
                    }
        except Exception as e:
            if retry < max_retries - 1:
                await asyncio.sleep(2)
                continue
            return {
                "user_id": user_id,
                "resource_id": resource_id,
                "round": round_num,
                "status": "error",
                "error": str(e),
                "response_time": 0
            }

async def main():
    print(f"开始并发测试")
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    # 记录初始系统资源使用情况
    process = psutil.Process(os.getpid())
    initial_memory = process.memory_info().rss / 1024 / 1024
    initial_cpu = psutil.cpu_percent()

    # 创建会话
    async with aiohttp.ClientSession() as session:
        all_results = []
        
        # 进行10轮测试
        for round_num in range(1, 11):
            print(f"\n第{round_num}轮测试开始...")
            
            # 每轮7个用户并发购买
            tasks = []
            for i in range(7):
                private_key = PRIVATE_KEYS[i]
                resource_id = RESOURCE_IDS[i]
                tasks.append(buy_access_token(session, private_key, resource_id, i+1, round_num))
            
            # 等待本轮所有任务完成
            round_results = await asyncio.gather(*tasks)
            all_results.extend(round_results)
            
            # 统计本轮结果
            success_count = sum(1 for r in round_results if r['status'] == 'success')
            error_count = sum(1 for r in round_results if r['status'] == 'error')
            print(f"第{round_num}轮结果: 成功={success_count}, 失败={error_count}")
            
            # 每轮结束后等待0.5秒
            await asyncio.sleep(0.5)

        # 统计总体结果
        successful_requests = sum(1 for r in all_results if r['status'] == 'success')
        failed_requests = sum(1 for r in all_results if r['status'] == 'error')
        total_response_time = sum(r.get('response_time', 0) for r in all_results)
        avg_response_time = total_response_time / len(all_results)

        print("\n总体测试结果:")
        print(f"总请求数: {len(all_results)}")
        print(f"成功请求: {successful_requests}")
        print(f"失败请求: {failed_requests}")
        print(f"平均响应时间: {avg_response_time:.2f} 秒")

    # 记录最终系统资源使用情况
    final_memory = process.memory_info().rss / 1024 / 1024
    final_cpu = psutil.cpu_percent()

    print("\n系统资源使用情况:")
    print(f"内存使用: {final_memory:.2f} MB (增加: {final_memory - initial_memory:.2f} MB)")
    print(f"CPU使用率: {final_cpu}%")

if __name__ == "__main__":
    asyncio.run(main()) 