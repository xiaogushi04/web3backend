import React, { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import axios from 'axios';

interface UploadFormProps {
  onUpload?: (file: File, metadata: any) => Promise<void>;
}

const UploadForm: React.FC<UploadFormProps> = ({ onUpload }) => {
  const { address } = useAccount();
  const [file, setFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState({
    title: '',
    description: '',
    resourceType: '0', // 0: Paper, 1: Dataset, 2: Code, 3: Other
    authors: [''], // 作者地址数组
    price: '0.01', // 添加默认价格
    royaltyPercentage: '5', // 添加默认版税比例
  });
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleMetadataChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setMetadata(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      alert('请选择要上传的文件');
      return;
    }

    if (!address) {
      alert('请先连接钱包');
      return;
    }

    setIsUploading(true);
    try {
      // 创建 FormData 对象
      const formData = new FormData();
      formData.append('file', file);
      formData.append('to', address);
      formData.append('title', metadata.title);
      formData.append('description', metadata.description);
      formData.append('resourceType', metadata.resourceType);
      formData.append('authors', JSON.stringify([address])); // 默认将上传者设为作者
      formData.append('price', metadata.price); // 添加价格
      formData.append('royaltyPercentage', metadata.royaltyPercentage); // 添加版税参数

      // 调用后端 API
      const response = await axios.post('/api/contracts/mint-with-file', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        alert('NFT 铸造成功！');
        // 重置表单
        setFile(null);
        setMetadata({
          title: '',
          description: '',
          resourceType: '0',
          authors: [''],
          price: '0.01', // 重置价格
          royaltyPercentage: '5' // 重置版税比例
        });
      } else {
        throw new Error(response.data.error || '铸造失败');
      }
    } catch (error) {
      console.error('上传失败:', error);
      alert('上传失败，请重试');
    } finally {
      setIsUploading(false);
    }
  };

  if (!address) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">请先连接钱包</h2>
        <p className="text-gray-600">您需要连接钱包才能上传资源</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">铸造学术资源 NFT</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 文件上传 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            选择文件
          </label>
          <div 
            className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 ${dragActive ? 'border-gray-500 bg-gray-50' : 'border-gray-300'} border-dashed rounded-md hover:border-gray-400 transition-all hover:scale-105`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="space-y-1 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="flex text-sm text-gray-600">
                <label
                  htmlFor="file-upload"
                  className="relative cursor-pointer bg-white rounded-md font-medium text-gray-900 hover:text-gray-700 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-gray-900"
                >
                  <span>上传文件</span>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    className="sr-only"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.txt,.zip"
                  />
                </label>
                <p className="pl-1">或拖放文件到此处</p>
              </div>
              <p className="text-xs text-gray-500">
                支持 PDF、Word、TXT、ZIP 等格式
              </p>
            </div>
          </div>
          {file && (
            <p className="mt-2 text-sm text-gray-500">
              已选择: {file.name}
            </p>
          )}
        </div>

        {/* 元数据表单 */}
        <div className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              标题
            </label>
            <input
              type="text"
              name="title"
              id="title"
              value={metadata.title}
              onChange={handleMetadataChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-gray-900 focus:border-gray-900 sm:text-sm text-gray-900"
              placeholder="请输入资源标题"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              描述
            </label>
            <textarea
              name="description"
              id="description"
              rows={3}
              value={metadata.description}
              onChange={handleMetadataChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-gray-900 focus:border-gray-900 sm:text-sm text-gray-900"
              placeholder="请输入资源描述"
              required
            />
          </div>

          <div>
            <label htmlFor="resourceType" className="block text-sm font-medium text-gray-700">
              资源类型
            </label>
            <select
              name="resourceType"
              id="resourceType"
              value={metadata.resourceType}
              onChange={handleMetadataChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-gray-900 focus:border-gray-900 sm:text-sm text-gray-900"
            >
              <option value="0">论文</option>
              <option value="1">数据集</option>
              <option value="2">代码</option>
              <option value="3">其他</option>
            </select>
          </div>

          <div>
            <label htmlFor="price" className="block text-sm font-medium text-gray-700">
              价格 (ETH)
            </label>
            <input
              type="number"
              name="price"
              id="price"
              step="0.001"
              min="0"
              value={metadata.price}
              onChange={handleMetadataChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-gray-900 focus:border-gray-900 sm:text-sm text-gray-900"
              placeholder="请输入资源价格"
              required
            />
            <p className="mt-1 text-xs text-gray-500">设置为0表示免费资源</p>
          </div>

          <div>
            <label htmlFor="royaltyPercentage" className="block text-sm font-medium text-gray-700">
              版税比例 (%)
            </label>
            <input
              type="number"
              name="royaltyPercentage"
              id="royaltyPercentage"
              min="0"
              max="15"
              step="0.1"
              value={metadata.royaltyPercentage}
              onChange={handleMetadataChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-gray-900 focus:border-gray-900 sm:text-sm text-gray-900"
              placeholder="请输入版税比例"
              required
            />
            <p className="mt-1 text-xs text-gray-500">版税比例范围：0-15%，每次交易时创作者将获得此比例的收益</p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isUploading}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? '铸造中...' : '铸造 NFT'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default UploadForm; 