import { useRef, useState } from 'react';

export const ChatInput = ({ onSend, disabled }) => {
  const [message, setMessage] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!message.trim() && !imageFile) return;

    onSend({
      content: message.trim(),
      type: imageFile ? 'image' : 'text',
      file: imageFile,
    });

    setMessage('');
    setImageFile(null);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div
      style={{
        background: '#f0f2f5',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'flex-end',
        gap: '8px',
        borderTop: '1px solid #e4e6eb',
      }}
    >
      {/* Attach button */}
      <button
        type='button'
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: '8px',
          color: '#54656f',
          fontSize: '24px',
          display: 'flex',
          alignItems: 'center',
          opacity: disabled ? 0.5 : 1,
        }}
        title='Attach image'
      >
        📎
      </button>
      <input
        ref={fileInputRef}
        type='file'
        accept='image/*'
        onChange={handleImageSelect}
        style={{ display: 'none' }}
      />

      {/* Message input */}
      <form
        onSubmit={handleSubmit}
        style={{ flex: 1, display: 'flex', gap: '8px' }}
      >
        <div style={{ flex: 1, position: 'relative' }}>
          {imageFile && (
            <div
              style={{
                position: 'absolute',
                bottom: '100%',
                left: 0,
                marginBottom: '8px',
                background: 'white',
                padding: '8px',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <img
                src={URL.createObjectURL(imageFile)}
                alt='Preview'
                style={{
                  width: '60px',
                  height: '60px',
                  objectFit: 'cover',
                  borderRadius: '4px',
                }}
              />
              <span style={{ fontSize: '14px', color: '#667781' }}>
                {imageFile.name}
              </span>
              <button
                type='button'
                onClick={() => setImageFile(null)}
                style={{
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                ×
              </button>
            </div>
          )}

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder='Type a message'
            disabled={disabled}
            style={{
              width: '100%',
              padding: '9px 12px',
              border: 'none',
              borderRadius: '8px',
              resize: 'none',
              fontSize: '15px',
              fontFamily: 'inherit',
              outline: 'none',
              minHeight: '42px',
              maxHeight: '120px',
              background: 'white',
              opacity: disabled ? 0.5 : 1,
            }}
            rows={1}
          />
        </div>

        {/* Send button */}
        <button
          type='submit'
          disabled={disabled || (!message.trim() && !imageFile)}
          style={{
            background: '#25d366',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '42px',
            height: '42px',
            cursor:
              disabled || (!message.trim() && !imageFile)
                ? 'not-allowed'
                : 'pointer',
            fontSize: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: disabled || (!message.trim() && !imageFile) ? 0.5 : 1,
            transition: 'all 0.2s',
          }}
          title='Send'
        >
          ➤
        </button>
      </form>
    </div>
  );
};
